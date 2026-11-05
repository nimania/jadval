"""Offline tests for bounded, polite recovery from intermittent empty index pages."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

TOOLS=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOLS))
import abadis_full_scan as scanner

class AllowRobots:
    def set_url(self,url):self.url=url
    def read(self):pass
    def can_fetch(self,ua,url):return True

class LookAheadTests(unittest.TestCase):
    def run_scan(self,links_by_page):
        calls=[]
        def fake_fetch(url,delay):
            calls.append(url)
            if '/crossword/' in url:
                import re
                m=re.search(r'[?&]pn=(\d+)',url)
                return str(int(m.group(1)) if m else 1)
            return 'detail'
        def fake_listing(html):
            page=int(html)
            return [(f'سرنخ شماره {i} صفحه {page}',f'https://abadis.ir/fatofa/test{page}_{i}/')
                    for i in range(links_by_page.get(page,0))]
        with tempfile.TemporaryDirectory() as d:
            output=str(Path(d)/'result.json')
            args=['crawler','--letter','ا','--page','1','--offset','0','--max-pages','3',
                  '--max-details','3','--delay','2','--out',output]
            with patch.object(sys,'argv',args),\
                 patch.object(scanner,'RobotFileParser',AllowRobots),\
                 patch.object(scanner,'fetch',side_effect=fake_fetch),\
                 patch.object(scanner,'listing',side_effect=fake_listing),\
                 patch.object(scanner,'section_answers',return_value=(['پاسخ'],None)):
                code=scanner.main()
            return code,json.loads(Path(output).read_text('utf-8')),calls

    def test_missing_first_page_preserved_and_next_is_reused(self):
        code,art,calls=self.run_scan({1:0,2:50})
        self.assertEqual(code,0)
        self.assertEqual(art['meta']['missing_index_pages'],1)
        self.assertEqual(art['meta']['lookahead_hits'],1)
        self.assertEqual(art['meta']['index_requests'],3)
        self.assertEqual(art['meta']['detail_requests'],3)
        self.assertEqual(art['pending_pages'][0]['page'],1)
        self.assertEqual(art['next_cursor'],{'letter':'ا','page':2,'offset':3})
        self.assertEqual(len(art['items']),3)
        self.assertEqual(sum('pn=2' in u for u in calls),1)

    def test_two_blank_pages_stop_without_declaring_end(self):
        code,art,calls=self.run_scan({1:0,2:0})
        self.assertEqual(code,0)
        self.assertEqual(art['meta']['status'],'unknown_empty_page')
        self.assertEqual(art['pending_pages'],[])
        self.assertEqual(art['next_cursor']['page'],1)
        self.assertEqual(art['meta']['index_requests'],3)
        self.assertEqual(art['meta']['detail_requests'],0)

    def test_ordinary_first_page_keeps_all_pairs(self):
        code,art,calls=self.run_scan({1:50})
        self.assertEqual(code,0)
        self.assertEqual(len(art['items']),3)
        self.assertEqual(art['meta']['missing_index_pages'],0)
        self.assertEqual(art['meta']['index_requests'],1)

if __name__=='__main__':unittest.main()
