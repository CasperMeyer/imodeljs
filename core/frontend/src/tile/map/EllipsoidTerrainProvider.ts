/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, Id64String } from "@bentley/bentleyjs-core";
import { Angle, Ellipsoid, EllipsoidPatch, Point2d, Point3d, Range1d, Range3d, Transform } from "@bentley/geometry-core";
import { QPoint3dList } from "@bentley/imodeljs-common";
import { IModelConnection } from "../../IModelConnection";
import { TerrainMeshPrimitive } from "../../render/primitives/mesh/TerrainMeshPrimitive";
import { MapCartoRectangle, MapTile, QuadId, TerrainMeshProvider } from "../internal";
import { MapTilingScheme, WebMercatorTilingScheme } from "./MapTilingScheme";

const scratchPoint2d = Point2d.createZero();
const scratchPoint = Point3d.createZero();
const scratchEllipsoid = Ellipsoid.create(Transform.createIdentity());
const scratchZeroRange = Range1d.createXX(0, 0);
const scratchPoints = new Array<Point3d>();

/** Terrain provider that produces geometry that represents a smooth ellipsoid without any height perturbations.
 * The area within the project extents are represented as planar tiles and other tiles are facetted approximations
 * of the WGS84 ellipsoid.
 * @see [[TerrainMeshProvider]]
 * @internal
 */
export class EllipsoidTerrainProvider extends TerrainMeshProvider {
  private _tilingScheme = new WebMercatorTilingScheme();
  constructor(iModel: IModelConnection, modelId: Id64String, private _wantSkirts: boolean) {
    super(iModel, modelId);
  }

  public get requiresLoadedContent() { return false; }
  public constructUrl(_row: number, _column: number, _zoomLevel: number): string { assert(false); return ""; }
  public isTileAvailable(_quadId: QuadId): boolean { return true; }
  public get maxDepth(): number { return 22; }
  public getChildHeightRange(_quadId: QuadId, _rectangle: MapCartoRectangle, _parent: MapTile): Range1d | undefined { return scratchZeroRange; }
  public get tilingScheme(): MapTilingScheme { return this._tilingScheme; }

  private getPlanarMesh(tile: MapTile): TerrainMeshPrimitive {
    const projection = tile.getProjection();
    const addQuad = ((m: TerrainMeshPrimitive, i0: number, i1: number, i2: number, i3: number) => m.indices.push(i0, i1, i2, i1, i3, i2));
    let mesh: TerrainMeshPrimitive;

    if (!this._wantSkirts) {
      mesh = TerrainMeshPrimitive.create({ range: projection.localRange });
      for (let v = 0; v < 2; v++)
        for (let u = 0; u < 2; u++) {
          mesh.uvParams.add(Point2d.create(u, 1 - v));
          mesh.points.add(projection.getPoint(u, v, 0, scratchPoint));
        }
      addQuad(mesh, 0, 1, 2, 3);
    } else {
      const points = new Array<Point3d>();
      const params = new Array<Point2d>();
      const skirtHeight = tile.range.xLength() / 20.0;
      for (let v = 0; v < 2; v++)
        for (let u = 0; u < 2; u++)
          for (let h = 0; h < 2; h++) {
            params.push(Point2d.create(u, 1 - v));
            points.push(projection.getPoint(u, v, h * skirtHeight));
          }
      mesh = TerrainMeshPrimitive.create({ range: Range3d.createArray(points) });
      points.forEach((point) => mesh.points.add(point));
      params.forEach((param) => mesh.uvParams.add(param));
      addQuad(mesh, 0, 2, 4, 6);
      const reorder = [0, 2, 6, 4, 0];
      for (let i = 0; i < 4; i++) {
        const iThis = reorder[i], iNext = reorder[i + 1];
        addQuad(mesh, iThis, iNext, iThis + 1, iNext + 1);
      }
    }

    return mesh;
  }
  private getGlobeMesh(tile: MapTile): TerrainMeshPrimitive | undefined {
    const globeMeshDimension = 10;
    const projection = tile.getProjection();
    const ellipsoidPatch = projection.ellipsoidPatch;

    if (undefined === ellipsoidPatch) {
      assert(false);
      return undefined;
    }

    const bordersSouthPole = tile.quadId.bordersSouthPole(this._tilingScheme);
    const bordersNorthPole = tile.quadId.bordersNorthPole(this._tilingScheme);

    const range = projection.localRange.clone();
    const delta = 1.0 / (globeMeshDimension - 3);
    const skirtFraction = delta / 2.0;
    const dimensionM1 = globeMeshDimension - 1, dimensionM2 = globeMeshDimension - 2;
    ellipsoidPatch.ellipsoid.transformRef.clone(scratchEllipsoid.transformRef);
    const skirtPatch = EllipsoidPatch.createCapture(scratchEllipsoid, ellipsoidPatch.longitudeSweep, ellipsoidPatch.latitudeSweep);
    const scaleFactor = Math.max(.99, 1 - Math.sin(ellipsoidPatch.longitudeSweep.sweepRadians * delta));
    skirtPatch.ellipsoid.transformRef.matrix.scaleColumnsInPlace(scaleFactor, scaleFactor, scaleFactor);
    const nTotal = globeMeshDimension * globeMeshDimension;

    const mesh = TerrainMeshPrimitive.create({ range });
    if (0 === scratchPoints.length)
      for (let i = 0; i < nTotal; i++)
        scratchPoints.push(Point3d.createZero());

    for (let iRow = 0, index = 0; iRow < globeMeshDimension; iRow++) {
      for (let iColumn = 0; iColumn < globeMeshDimension; iColumn++, index++) {
        let u = (iColumn ? (Math.min(dimensionM2, iColumn) - 1) : 0) * delta;
        let v = (iRow ? (Math.min(dimensionM2, iRow) - 1) : 0) * delta;
        mesh.uvParams.add(Point2d.create(u, 1 - v, scratchPoint2d));
        const thisPoint = scratchPoints[index];

        if (iRow === 0 || iRow === dimensionM1 || iColumn === 0 || iColumn === dimensionM1) {
          if (bordersSouthPole && iRow === dimensionM1)
            skirtPatch.ellipsoid.radiansToPoint(0, -Angle.piOver2Radians, thisPoint);
          else if (bordersNorthPole && iRow === 0)
            skirtPatch.ellipsoid.radiansToPoint(0, Angle.piOver2Radians, thisPoint);
          else {
            u += (iColumn === 0) ? -skirtFraction : (iColumn === dimensionM1 ? skirtFraction : 0);
            v += (iRow === 0) ? -skirtFraction : (iRow === dimensionM1 ? skirtFraction : 0);
            skirtPatch.uvFractionToPoint(u, v, thisPoint);
          }
        } else {
          projection.getPoint(u, v, 0, thisPoint);
        }
      }
    }
    QPoint3dList.fromPoints(scratchPoints, mesh.points);

    const rowMin = (bordersNorthPole || this._wantSkirts) ? 0 : 1;
    const rowMax = (bordersSouthPole || this._wantSkirts) ? dimensionM1 : dimensionM2;
    const colMin = this._wantSkirts ? 0 : 1;
    const colMax = this._wantSkirts ? dimensionM1 : dimensionM2;
    for (let iRow = rowMin; iRow < rowMax; iRow++) {
      for (let iColumn = colMin; iColumn < colMax; iColumn++) {
        const base = iRow * globeMeshDimension + iColumn;
        const top = base + globeMeshDimension;
        mesh.indices.push(base);
        mesh.indices.push(base + 1);
        mesh.indices.push(top);
        mesh.indices.push(top);
        mesh.indices.push(base + 1);
        mesh.indices.push(top + 1);
      }
    }
    return mesh;
  }
  public async getMesh(tile: MapTile, _data: Uint8Array): Promise<TerrainMeshPrimitive | undefined> {
    return tile.isPlanar ? this.getPlanarMesh(tile) : this.getGlobeMesh(tile);
  }
}
