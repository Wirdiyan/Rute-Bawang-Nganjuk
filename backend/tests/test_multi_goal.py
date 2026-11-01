import itertools
import json
import math
import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import networkx as nx
from fastapi.testclient import TestClient

from backend.algorithms.astar import AStarError, haversine_m
from backend.algorithms.multi_goal import multi_goal_astar
from backend.algorithms.route_optimizer import optimize_route
from backend.api.main import app
from backend.api import solver


def document_graph():
    matrix = [[0,4,7,9],[4,0,5,8],[7,5,0,3],[9,8,3,0]]
    graph = nx.MultiDiGraph()
    for n in range(4):
        graph.add_node(n, x=0.0, y=0.0)
    for i in range(4):
        for j in range(4):
            if i != j:
                graph.add_edge(i,j,length=matrix[i][j])
    return graph


def reference_product(graph, start, goals):
    """Independent Dijkstra oracle on the explicit node × mask graph."""
    product = nx.DiGraph()
    bits = {n:1 << i for i,n in enumerate(goals)}
    for n in graph:
        for mask in range(1 << len(goals)):
            product.add_node((n,mask))
            for v in graph.successors(n):
                data=graph.get_edge_data(n,v)
                weight=min(float(d['length']) for d in data.values()) if graph.is_multigraph() else float(data['length'])
                product.add_edge((n,mask),(v,mask | bits.get(v,0)),weight=weight)
    return product


class MultiGoalTests(unittest.TestCase):
    def test_document_optimum_and_goal_return(self):
        result=multi_goal_astar(document_graph(),0,[1,2,3])
        self.assertEqual(result['distance_m'],21)
        self.assertEqual(result['path'][0],0)
        self.assertEqual(result['path'][-1],0)
        self.assertEqual(result['states'][-1],{'node':0,'mask':7})
        self.assertEqual(result['search_steps'][-1]['status'],'goal')

    def test_random_directed_graphs_and_admissible_heuristic(self):
        for seed in range(12):
            with self.subTest(seed=seed):
                rng=random.Random(seed)
                graph=nx.MultiDiGraph()
                for n in range(6):graph.add_node(n,x=n*0.00001,y=0.0)
                for u in graph:
                    for v in graph:
                        if u != v and (v==(u+1)%6 or rng.random()<0.4):
                            graph.add_edge(u,v,length=max(haversine_m(graph,u,v),rng.uniform(2,15)))
                product=reference_product(graph,0,[1,3,5])
                expected=nx.shortest_path_length(product,(0,0),(0,7),weight='weight')
                result=multi_goal_astar(graph,0,[1,3,5])
                self.assertAlmostEqual(result['distance_m'],expected)
                self.assertAlmostEqual(multi_goal_astar(graph,0,[1,3,5],heuristic='zero')['distance_m'],expected)
                for step in result['search_steps']:
                    remaining=nx.shortest_path_length(product,(step['node'],step['mask']),(0,7),weight='weight')
                    self.assertLessEqual(step['h'],remaining+1e-7)

    def test_trace_reconstructs_exact_open_closed_counts(self):
        result=multi_goal_astar(document_graph(),0,[1,2,3])
        opened={result['initial_state']['key']};closed=set()
        for step in result['search_steps']:
            opened.discard(step['key']);closed.add(step['key'])
            for change in step['opened']:
                closed.discard(change['key']);opened.add(change['key'])
            self.assertEqual(len(opened),step['open_count'])
            self.assertEqual(len(closed),step['closed_count'])

    def test_asymmetric_cycle_and_parallel_edges(self):
        graph=nx.MultiDiGraph()
        for n in range(4):graph.add_node(n,x=0,y=0)
        for u,v in [(0,1),(1,2),(2,3),(3,0)]:graph.add_edge(u,v,length=2)
        graph.add_edge(0,1,length=20)
        result=multi_goal_astar(graph,0,[1,2,3])
        self.assertEqual(result['path'],[0,1,2,3,0])
        self.assertEqual(result['distance_m'],8)

    def test_road_nodes_may_repeat_with_different_masks(self):
        graph=nx.MultiDiGraph()
        for n in range(4):graph.add_node(n,x=0,y=0)
        for n in [1,2,3]:graph.add_edge(0,n,length=1);graph.add_edge(n,0,length=1)
        result=multi_goal_astar(graph,0,[1,2,3])
        self.assertEqual(result['distance_m'],6)
        self.assertGreater(result['path'].count(0),2)
        self.assertEqual(len({s['mask'] for s in result['states'] if s['node']==0}),4)

    def test_unreachable_return(self):
        graph=nx.DiGraph();graph.add_node(0,x=0,y=0);graph.add_node(1,x=0,y=0);graph.add_edge(0,1,length=1)
        with self.assertRaises(AStarError):multi_goal_astar(graph,0,[1])

    def test_invalid_inputs_and_nonnegative_zero_cost(self):
        for goals in [[],[1,1],[0]]:
            with self.subTest(goals=goals),self.assertRaises(AStarError):multi_goal_astar(document_graph(),0,goals)
        for value in [-1,float('nan'),float('inf')]:
            graph=document_graph();graph[0][1][0]['length']=value
            with self.subTest(value=value),self.assertRaises(AStarError):multi_goal_astar(graph,0,[1])
        graph=document_graph();graph[0][1][0]['length']=0
        self.assertTrue(math.isfinite(multi_goal_astar(graph,0,[1])['distance_m']))

    def test_unsafe_geometry_rejected_with_zero_fallback(self):
        graph=document_graph();graph.nodes[1]['x']=1.0
        with self.assertRaises(AStarError):multi_goal_astar(graph,0,[1])
        self.assertEqual(multi_goal_astar(graph,0,[1],heuristic='zero')['distance_m'],8)

    def test_search_budget_does_not_publish_partial_optimum(self):
        with self.assertRaisesRegex(AStarError,'Batas ekspansi'):multi_goal_astar(document_graph(),0,[1,2,3],max_expansions=1)

    def test_baseline_variable_goal_count(self):
        graph=document_graph()
        for count in range(1,4):
            goals=list(range(1,count+1))
            reference=optimize_route(graph,{'name':'0','nearest_node':0},[{'name':str(n),'nearest_node':n} for n in goals])
            self.assertEqual(len(reference['candidates']),math.factorial(count))
            self.assertAlmostEqual(reference['total_distance_m'],multi_goal_astar(graph,0,goals)['distance_m'])


class LiveApiTests(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.root=Path(self.folder.name)
        self.graph=document_graph()
        nx.write_graphml(self.graph,self.root/'road_network.graphml')
        names=['Sukomoro','Nganjuk','Rejoso','Gondang']
        items=[{'name':n,'latitude':0,'longitude':0,'nearest_node':i,'place_type':'reference'} for i,n in enumerate(names)]
        (self.root/'locations.json').write_text(json.dumps({'warehouse':items[0],'destinations':items[1:],'metadata':{}}),encoding='utf-8')
        self.patcher=patch.object(solver,'OUTPUT',self.root);self.patcher.start();solver._load_dataset.cache_clear()
        self.client=TestClient(app)

    def tearDown(self):
        self.client.close();solver._load_dataset.cache_clear();self.patcher.stop();self.folder.cleanup()

    def test_fresh_run_and_changed_selection(self):
        one=self.client.post('/api/route/optimize',json={})
        self.assertEqual(one.status_code,200,one.text[:300])
        first=one.json();self.assertEqual(first['total_distance_m'],21)
        self.assertTrue(first['comparison']['matches']);self.assertEqual(len(first['candidates']),6)
        second=self.client.post('/api/route/optimize',json={'destinations':['Nganjuk']}).json()
        self.assertNotEqual(first['run_id'],second['run_id']);self.assertEqual(second['total_distance_m'],8)
        self.assertEqual(len(second['candidates']),1);self.assertEqual(second['route'],['Sukomoro','Nganjuk','Sukomoro'])
        self.assertTrue(first['path_coordinates']);self.assertTrue(first['dataset']['simulation'])

    def test_closed_road_changes_route_and_does_not_mutate_dataset(self):
        body={'destinations':['Nganjuk'],'blocked_edges':[{'source':0,'target':1}]}
        response=self.client.post('/api/route/optimize',json=body)
        self.assertEqual(response.status_code,200,response.text[:300]);self.assertGreater(response.json()['total_distance_m'],8)
        self.assertEqual(self.client.post('/api/route/optimize',json={'destinations':['Nganjuk']}).json()['total_distance_m'],8)

    def test_validation_and_no_false_success(self):
        for body in [{'destinations':[]},{'destinations':['Nganjuk','Nganjuk']},{'destinations':['Unknown']},{'heuristic':'invalid'}, {'blocked_edges':[{'source':9,'target':8}]},{'warehouse':'Unknown'},{'unexpected':True}]:
            with self.subTest(body=body):self.assertEqual(self.client.post('/api/route/optimize',json=body).status_code,422)

    def test_unreachable_scenario(self):
        response=self.client.post('/api/route/optimize',json={'blocked_edges':[{'source':0,'target':n} for n in [1,2,3]]})
        self.assertEqual(response.status_code,422)

    def test_zero_heuristic_and_baseline_disabled(self):
        result=self.client.post('/api/route/optimize',json={'heuristic':'zero','compare_baseline':False}).json()
        self.assertEqual(result['total_distance_m'],21);self.assertEqual(result['candidates'],[])
        self.assertFalse(result['comparison']['enabled']);self.assertTrue(all(s['h']==0 for s in result['trace']))

    def test_simulation_metadata_cors_and_schema(self):
        data=self.client.get('/api/dataset').json()
        self.assertTrue(data['simulation']);self.assertTrue(data['geometric_lower_bound_valid'])
        self.assertTrue(all(not point['confirmed_delivery_point'] for point in data['locations']))
        preflight=self.client.options('/api/route/optimize',headers={'Origin':'http://localhost:5173','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'})
        self.assertEqual(preflight.status_code,200)
        self.assertIn('post',self.client.get('/openapi.json').json()['paths']['/api/route/optimize'])

    def test_geometry_orientation_uses_shortest_parallel_edge(self):
        graph=nx.MultiDiGraph();graph.add_node(0,x=0,y=0);graph.add_node(1,x=1,y=0)
        graph.add_edge(0,1,length=4,geometry='LINESTRING (1 0, 0.5 0.2, 0 0)')
        graph.add_edge(0,1,length=9,geometry='LINESTRING (0 0, 1 0)')
        points=solver.expand_geometry(graph,[0,1])
        self.assertEqual(points,[{'latitude':0.,'longitude':0.},{'latitude':.2,'longitude':.5},{'latitude':0.,'longitude':1.}])


if __name__=='__main__':unittest.main()
