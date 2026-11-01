import math
import unittest

import networkx as nx

from backend.road_lesson import build_road_lesson, compress_corridor, search_lesson, simple_road_graph
from backend.api.solver import load_dataset


class RoadLessonTests(unittest.TestCase):
    def test_compressed_edges_are_auditable_and_keep_the_minimum(self):
        road=nx.DiGraph()
        road.add_nodes_from((n,{'x':0.,'y':0.}) for n in range(8))
        paths=[[0,1,2,7],[0,3,4,7],[0,5,6,7]]
        for index,path in enumerate(paths):
            for u,v in zip(path,path[1:]):road.add_edge(u,v,length=100*(index+1))
        compressed=compress_corridor(road,paths,0,7)
        self.assertGreaterEqual(len(compressed)-2,2)
        self.assertLessEqual(len(compressed)-2,4)
        for u,v,attrs in compressed.edges(data=True):
            self.assertEqual(attrs['path'][0],u)
            self.assertEqual(attrs['path'][-1],v)
            self.assertEqual(attrs['length'],nx.path_weight(road,attrs['path'],'length'))
        self.assertEqual(nx.shortest_path_length(compressed,0,7,weight='length'),300)
        self.assertEqual(nx.shortest_path_length(road,0,7,weight='length'),300)

    def test_trace_starts_unsolved_and_each_pop_has_minimum_f(self):
        nodes=[{'id':n,'latitude':0.,'longitude':0.} for n in ['S','A','B','T']]
        edges=[{'id':str(i),'source':u,'target':v,'distance_m':w} for i,(u,v,w) in enumerate([
            ('S','A',10),('S','B',2),('B','A',3),('A','T',1),('B','T',20)])]
        result=search_lesson(nodes,edges,'S','T')
        self.assertIsNone(result['steps'][0]['node'])
        self.assertFalse(result['steps'][0]['goal'])
        self.assertEqual(result['distance_m'],6)
        self.assertEqual(result['path'],['S','B','A','T'])
        for step in result['steps'][1:]:
            self.assertAlmostEqual(step['f'],min(row['f'] for row in step['open_before']))
        self.assertTrue(result['steps'][-1]['goal'])

    def test_real_corridors_have_two_to_four_intermediates_and_true_costs(self):
        graph,raw,_=load_dataset()
        road=simple_road_graph(graph)
        by={p['name']:p['nearest_node'] for p in [raw['warehouse'],*raw['destinations']]}
        route=['Sukomoro','Gondang','Rejoso','Nganjuk','Sukomoro']
        for index,(origin,target) in enumerate(zip(route,route[1:])):
            with self.subTest(origin=origin,target=target):
                path=nx.shortest_path(road,by[origin],by[target],weight='length')
                lesson=build_road_lesson(road,{'from':origin,'to':target,'path':path},index)
                self.assertTrue(2<=len(lesson['nodes'])-2<=4)
                self.assertTrue(any(n['locality'] for n in lesson['nodes']))
                for edge in lesson['edges']:
                    self.assertAlmostEqual(edge['distance_m'],nx.path_weight(road,edge['path'],'length'))
                self.assertAlmostEqual(lesson['searches']['guided']['distance_m'],nx.path_weight(road,path,'length'))
                self.assertAlmostEqual(lesson['searches']['zero']['distance_m'],lesson['distance_m'])

    def test_closed_direction_is_absent_from_every_displayed_chain(self):
        graph,raw,_=load_dataset()
        road=simple_road_graph(graph)
        source=raw['warehouse']['nearest_node']
        goal=next(p['nearest_node'] for p in raw['destinations'] if p['name']=='Gondang')
        original=nx.shortest_path(road,source,goal,weight='length')
        blocked=(original[1],original[2])
        road.remove_edge(*blocked)
        path=nx.shortest_path(road,source,goal,weight='length')
        lesson=build_road_lesson(road,{'from':'Sukomoro','to':'Gondang','path':path},0)
        for edge in lesson['edges']:
            self.assertNotIn(blocked,list(zip(edge['path'],edge['path'][1:])))
        self.assertAlmostEqual(lesson['distance_m'],nx.path_weight(road,path,'length'))


if __name__=='__main__':unittest.main()
