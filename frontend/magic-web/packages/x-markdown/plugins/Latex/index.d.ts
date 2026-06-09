import { type KatexOptions } from 'katex';
import type { TokenizerAndRendererExtension } from 'marked';
import 'katex/dist/katex.min.css';
type LatexOption = {
    katexOptions?: KatexOptions;
    replaceAlignStart?: boolean;
};
declare const Latex: (options?: LatexOption) => TokenizerAndRendererExtension[];
export default Latex;
