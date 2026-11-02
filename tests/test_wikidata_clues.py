"""Offline unit tests for Wikidata fact staging; no network access."""
from pathlib import Path
import importlib.util
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/'tools'/'wikidata_fact_candidates.py'
spec=importlib.util.spec_from_file_location('wikidata_clues',SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class WikidataCandidateTests(unittest.TestCase):
    def test_stable_normalization(self):
        self.assertEqual(mod.norm('كــتاب'), 'کتاب')
        self.assertEqual(mod.norm('آباد'), 'آباد')
        self.assertNotEqual(mod.norm('آباد'),mod.norm('اباد'))

    def test_ambiguous_country_skipped(self):
        rows=[
            dict(country_id='Q1',country='کشور',answer_id='Q2',answer='تهران'),
            dict(country_id='Q1',country='کشور',answer_id='Q3',answer='تبریز'),
            dict(country_id='Q4',country='ایران',answer_id='Q5',answer='تهران')
        ]
        items,stats=mod.generate(rows,'P36','پایتخت {country}','جغرافیا')
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]['answer'],'تهران')
        self.assertEqual(stats['multiple_answers_omitted'],1)
        self.assertEqual(items[0]['status'],'needs_review')
        self.assertIs(items[0]['reviewed'],False)

    def test_non_persian_answer_not_added(self):
        rows=[dict(country_id='Q1',country='ایران',answer_id='Q5',answer='New York')]
        items,stats=mod.generate(rows,'P36','پایتخت {country}','جغرافیا')
        self.assertFalse(items)
        self.assertEqual(stats['non_persian_or_length_omitted'],1)

    def test_wrong_property_rejected(self):
        with self.assertRaises(ValueError):mod.query_string('P999')

if __name__=='__main__':unittest.main()
