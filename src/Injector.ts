// @ts-ignore
import * as usfmjs from "usfm-js";
import Reference from "./Reference";
import AlignedSegment, {Alignment} from "./AlignedSegment";
import {Token} from 'wordmap-lexer';

/**
 * Injects alignment data into usfm
 * @param alignments
 * @param {string} usfm
 * @return {string} usfm3
 */
export function alignUSFM(alignments: any, usfm: string): string {
    const usfmObject = usfmjs.toJSON(usfm);

    if (alignments) {
        for (const verseId of Object.keys(alignments.segments)) {
            const segment = AlignedSegment.fromJson(alignments.segments[verseId]);
            const reference = Reference.buildFromContext(segment.target.context);

            const cId = reference.chapter.toString();
            const vId = reference.verse.toString();

            // look up verse
            if (Object.keys(usfmObject.chapters).indexOf(cId) >= 0 && Object.keys(usfmObject.chapters[cId]).indexOf(vId) >= 0) {
                // apply alignments
                try {
                    usfmObject.chapters[cId][vId] = alignSegment(segment);
                } catch (e) {
                    console.error(`Error caught at ${cId}:${vId}`);
                    throw e;
                }
            } else {
                console.warn(`${reference} not found in usfm`);
            }
        }
    }

    return usfmjs.toUSFM(usfmObject);
}

/**
 * Filters and sorts alignments
 * @param alignments
 */
function sanitizeAlignments(alignments: Alignment[]): Alignment[] {
    const cleaned = [];
    for (const a of alignments) {
        // skip empty alignments
        if (a.targetNgram.length === 0 || a.sourceNgram.length === 0) {
            continue;
        }
        cleaned.push(a);
    }
    return cleaned.sort(Alignment.comparator);
}

/**
 * Converts an aligned segment to usfm
 * @param segment
 */
export function alignSegment(segment: AlignedSegment) {

    const usfmObjects = [];
    let lastTargetTokenPos: number = -1;
    const alignments = sanitizeAlignments(segment.alignments);

    // build usfm
    for (const alignment of alignments) {

        // skip empty alignments
        if (alignment.targetNgram.length === 0 || alignment.sourceNgram.length === 0) {
            continue;
        }

        // add un-aligned target tokens
        if (lastTargetTokenPos >= 0) {
            while (lastTargetTokenPos < alignment.targetNgram[0] - 1) {
                lastTargetTokenPos++;
                const token = segment.target.getTokenSafely(lastTargetTokenPos);
                usfmObjects.push(makeWord(token));
            }
        }

        // collect aligned target tokens
        const children = [];
        for (const targetPos of alignment.targetNgram) {
            const token = segment.target.getTokenSafely(targetPos);
            children.push(makeWord(token));
        }

        // build milestone(s)
        const sourceTokens = alignment.sourceNgram.map(i => {
            return segment.source.getTokenSafely(i);
        });

        const usfmObj = makeMilestone(sourceTokens, children, Boolean(alignment.verified));
        usfmObjects.push(usfmObj);

        lastTargetTokenPos = alignment.targetNgram[alignment.targetNgram.length - 1];
    }

    // add remaining un-aligned target tokens
    if (lastTargetTokenPos >= 0) {
        while (lastTargetTokenPos < segment.target.length - 1) {
            lastTargetTokenPos++;
            const token = segment.target.getTokenSafely(lastTargetTokenPos);
            usfmObjects.push(makeWord(token));
        }
    }
    return usfmObjects;
}

function makeWord(token: Token): any {
    return {
        occurrence: token.occurrence,
        occurrences: token.occurrences,
        text: token.toString(),
        type: "word"
    };
}

/**
 * Recursively generates a milestone
 * @param sourceTokens - the source tokens
 * @param children - the children of the milestone
 * @param verified - indicates if the alignment has been verified
 */
function makeMilestone(sourceTokens: any[], children: any[], verified: boolean): any {
    if (sourceTokens && sourceTokens.length > 0) {
        const token = sourceTokens[0];
        return {
            verified,
            occurrence: token.occurrence,
            occurrences: token.occurrences,
            content: token.text,
            tag: "zaln",
            type: "milestone",
            children: makeMilestone(sourceTokens.slice(1), children, verified)
        };
    } else {
        return children;
    }
}
