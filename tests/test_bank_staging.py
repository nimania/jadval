"""Tests for the offline staging importer (not production import)."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from argparse import Namespace

MODULE = Path(__file__).resolve().parents[1] / 'tools' / 'stage_bank_candidates.py'
spec = importlib.util.spec_from_file_location('stage_bank_candidates', MODULE)
stage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stage)

class BankStagingTests(unittest.TestCase):
    def test_normalization_keeps_alef_madda(self):
        self.assertEqual(stage.normalize('كــتاب'),'کتاب')
        self.assertEqual(stage.normalize('مي‌رويم'),'میرویم')
        self.assertNotEqual(stage.normalize('آباد'),stage.normalize('اباد'))

    def test_does_not_accept_short_or_nonpersian(self):
        self.assertFalse(stage.valid_answer('آب'))
        self.assertFalse(stage.valid_answer('ABC'))

    def test_deduplicates_word_candidates_without_approving(self):
        rows=['كتاب','کتاب','آب','تاریخ']
        items,rejected,duplicates=stage.create_records(rows,'words','source','','MIT',3,20)
        self.assertEqual([x['answer'] for x in items],['کتاب','تاریخ'])
        self.assertEqual(duplicates,1)
        self.assertEqual(rejected['invalid-answer-or-length'],1)
        self.assertTrue(all(x['reviewed'] is False and x['clue'] is None for x in items))

    def test_multiple_clues_share_one_answer(self):
        rows=[{'answer':'شیراز','clue':'مرکز استان فارس'},
              {'answer':'شیراز','clue':'شهر حافظ'}]
        items,rejected,dup=stage.create_records(rows,'pairs','source','','internal',3,20)
        self.assertEqual(len(items),2)
        self.assertEqual(stage.build_report(items,rejected,dup,set())['distinct_answers'],1)

    def test_unavailable_private_bank_does_not_claim_new_words(self):
        rows=[item for item in ['کتاب','شیراز']]
        items,rejected,dup=stage.create_records(rows,'words','source','','MIT',3,20)
        summary=stage.build_report(items,rejected,dup,None)
        self.assertIsNone(summary['overlap_with_existing_answers'])
        self.assertIsNone(summary['new_answers_vs_existing'])
        self.assertIsNone(summary['existing_answers_count'])

    def test_never_overwrites_staging_output_by_default(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)
            inp=path/'words.txt'
            inp.write_text('آسمان\nکتاب\n',encoding='utf-8')
            out=path/'candidates.jsonl'
            args=Namespace(mode='words',input=str(inp),output=str(out),
                           existing=None,source_id='source',source_url='',
                           license='MIT',min_letters=3,max_letters=20,
                           overwrite=False)
            stage.run(args)
            self.assertEqual(len(out.read_text(encoding='utf-8').splitlines()),2)
            with self.assertRaises(FileExistsError):stage.run(args)

if __name__=='__main__':
    unittest.main()
