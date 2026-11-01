"""Reproducible integration check on the committed OSM dataset; writes no data."""
import math
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import networkx as nx
from backend.api.solver import load_dataset, run_solver
from backend.api.schemas import SolveRequest
from backend.algorithms.multi_goal import multi_goal_astar

graph, raw, dataset=load_dataset()
result=run_solver(SolveRequest())
assert result['comparison']['matches']
assert result['route'][0]==result['route'][-1]=='Sukomoro'
assert set(result['route'][1:-1])=={'Nganjuk','Rejoso','Gondang'}
assert result['trace'][-1]['status']=='goal'
assert result['trace'][-1]['mask']==7
zero=multi_goal_astar(graph,raw['warehouse']['nearest_node'],[x['nearest_node'] for x in raw['destinations']],heuristic='zero',record_trace=False)
assert math.isclose(zero['distance_m'],result['total_distance_m'],abs_tol=1e-5)
print('Dataset version:',dataset['version'])
print('Route:', ' -> '.join(result['route']))
print('Distance m:',result['total_distance_m'])
print('MST expanded:',result['statistics']['expanded_states'],'Zero expanded:',zero['statistics']['expanded_states'])
print('MST reopened states:',result['statistics']['reopened_states'])
print('Geometry points:',len(result['path_coordinates']))
print('A* multi-goal / zero heuristic / permutation baseline: MATCH')
