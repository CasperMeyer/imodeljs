/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Range3d } from "@bentley/geometry-core/lib/PointVector";
import { ClipVector } from "@bentley/geometry-core/lib/numerics/ClipVector";

// tslint:disable:variable-name

/**
 * The fence clip mode controls element acceptance criteria. A clip mode of none returns
 * only elements inside the fence when overlaps aren't requested. A clip mode of
 * original or copy always returns overlapping elements. The actual clip behavior varies
 * according to the fence operation, ex. delete, move, copy.
 */
export const enum FenceClipMode {
  /** Inclusion of inside/overlapping elements controlled by overlap mode. No clipping of elements satisfying the fence criteria. */
  None = 0,
  /** Include elements that overlap the fence. Tools will modify the original element. */
  Original = 1,
  /** Include elements that overlap the fence. Tools will not modify the original element. */
  Copy = 3,
}

/**
 * Class for finding elements that are inside or overlap a volume defined by an
 * extrusion of a planar region profile.
 */
export class FenceParams {
  public m_overlapMode = false;
  public m_onTolerance = .25;
  public m_viewport?: Viewport;
  public m_clipMode = FenceClipMode.None;
  public m_clip?: ClipVector;
  public hasOverlaps = false;
  public readonly m_fenceRangeNPC = new Range3d();
}
