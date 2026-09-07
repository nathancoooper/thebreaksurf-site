import { findAndReplace } from 'mdast-util-find-and-replace';
import type { Root, PhrasingContent } from 'mdast';
import type { Plugin } from 'unified';

const HIGHLIGHT_RE = /==((?:(?!==).)+)==/g;

const remarkHighlight: Plugin<[], Root> = () => (tree) => {
  findAndReplace(tree, [
    [
      HIGHLIGHT_RE,
      (_match: string, text: string) =>
        ({ type: 'highlightMark', children: [{ type: 'text', value: text }] }) as unknown as PhrasingContent,
    ],
  ]);
};

export default remarkHighlight;
