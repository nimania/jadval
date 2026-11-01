import importlib.util
import unittest
from pathlib import Path

from generate import audit_draft, can_place, generate, load_entries, place

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "claude_bridge", ROOT / "tools" / "convert_claude_crossword.py"
)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class WordFirstIntegrationTests(unittest.TestCase):
    def test_directional_ownership_does_not_bury_same_orientation(self):
        grid = [[""] * 5 for _ in range(5)]
        occupancy = {
            "across": [[False] * 5 for _ in range(5)],
            "down": [[False] * 5 for _ in range(5)],
        }
        place(grid, "بار", 2, 3, 0, -1, occupancy)
        self.assertFalse(can_place(grid, "بار", 2, 3, 0, -1, occupancy))
        self.assertEqual(1, can_place(grid, "تات", 1, 2, 1, 0, occupancy))
        place(grid, "تات", 1, 2, 1, 0, occupancy)
        self.assertTrue(occupancy["across"][2][2])
        self.assertTrue(occupancy["down"][2][2])

    def test_generated_drafts_are_audited_and_never_auto_published(self):
        entries = load_entries(ROOT / "sample.json")
        result = generate(entries, 15, 27)
        audit = result["_draft"]["audit"]
        self.assertEqual("draft", result["meta"]["status"])
        self.assertFalse(result["_draft"]["publication_ready"])
        self.assertEqual(225, audit["black_cells"] + audit["letter_cells"])
        self.assertEqual(0, audit["uncovered_letters"])
        self.assertEqual([], audit["unexpected_runs"])
        self.assertGreater(result["_draft"]["placed"], 0)

    def sample_bridge_data(self):
        # Physical columns increase left to right. Across answers read RTL.
        grid = [list("راب"), list("ربا"), list("بار")]
        entries = []
        for r, row in enumerate(grid):
            entries.append({"word": "".join(reversed(row)), "dir": "A", "r": r, "c": 0})
        for c in range(3):
            entries.append({"word": "".join(grid[r][c] for r in range(3)),
                            "dir": "D", "r": 0, "c": c})
        source = {"grid": {"size": 3, "black": [[0] * 3 for _ in range(3)],
                           "letters": grid, "entries": entries}}
        words = {e["word"] for e in entries}
        bank = [{"answer": w, "clue": "پرسشِ مستندِ " + w, "reviewed": 1}
                for w in words]
        return source, bank

    def test_converter_uses_real_clues_and_preserves_rtl(self):
        source, bank = self.sample_bridge_data()
        converted = bridge.convert(source, bank)
        self.assertEqual("draft", converted["meta"]["status"])
        self.assertFalse(converted["_draft"]["publication_ready"])
        self.assertEqual(source["grid"]["letters"], converted["grid"])
        self.assertEqual(3, len(converted["clues"]["horizontal"]))
        self.assertEqual(3, len(converted["clues"]["vertical"]))
        self.assertEqual(0, converted["_draft"]["singleton_runs"])
        self.assertTrue(converted["_draft"]["strict_structure_pass"])

    def test_converter_rejects_invented_clue_or_corrupted_entry(self):
        source, bank = self.sample_bridge_data()
        with self.assertRaisesRegex(ValueError, "No original clue"):
            bridge.convert(source, bank[:-1])
        source["grid"]["entries"][0]["word"] = "غلط"
        with self.assertRaisesRegex(ValueError, "does not match"):
            bridge.convert(source, bank)


if __name__ == "__main__":
    unittest.main()
