import unittest
from probe import completion_edit


class CompletionPosition(unittest.TestCase):
    def test_shared_variable_prefix_does_not_move_cursor_before_member(self):
        source = 'package sample;\nimport sample.Pose2d;\nclass Probe {\n  double sample(Pose2d pose) { return pose.position.x; }\n}\n'
        edited, line, column = completion_edit(source, 'position', 3)
        self.assertEqual(edited, source.replace('position', 'pos'))
        self.assertEqual((line, column), (3, 46))


if __name__ == '__main__':
    unittest.main()
