"""Regression checks for the source JSON reading order.

Run with: python3 -m unittest discover -s tests
"""
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from import_puzzles import extract

class SourceOrderTests(unittest.TestCase):
    def test_horizontal_and_vertical(self):
        puzzle={
            "grid":[list("کتاب"),list("بالف"),list("نرمش"),list("کنار")],
            "clues":{
                "horizontal":{"1":["سؤال کتاب"],"2":["سؤال بالف"],"3":["سؤال نرمش"],"4":["سؤال کنار"]},
                "vertical":{"1":["ستون یک"],"2":["ستون دو"],"3":["ستون سه"],"4":["ستون چهار"]}
            }
        }
        entries=list(extract(puzzle))
        self.assertIn(("سؤال کتاب","کتاب","across"),entries)
        self.assertIn(("ستون یک","کبنک","down"),entries)
        self.assertIn(("ستون چهار","بفشر","down"),entries)

if __name__=="__main__":unittest.main()
