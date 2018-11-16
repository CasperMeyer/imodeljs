/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ActivityLoggingContext, IModelStatus, Id64String } from "@bentley/bentleyjs-core";
import { assert } from "chai";
import * as path from "path";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelDb, DictionaryModel, SpatialCategory, TxnAction } from "../../backend";
import { GeometricElementProps, Code, IModel, SubCategoryAppearance, ColorByName, IModelError } from "@bentley/imodeljs-common";

describe.only("TxnManager", () => {
  let imodel: IModelDb;
  const actx = new ActivityLoggingContext("");

  before(() => {
    imodel = IModelTestUtils.openIModel("test.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("Undo/Redo", () => {

    try {
      imodel.getMetaData("TestBim:TestPhysicalObject");
    } catch (err) {
      const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
      imodel.importSchema(actx, schemaPathname); // will throw an exception if import fails
      assert.isDefined(imodel.getMetaData("TestBim:TestPhysicalObject"), "TestPhysicalObject is present");
      imodel.saveChanges("schema change");
    }

    const txns = imodel.txns;
    imodel.nativeDb.enableTxnTesting();
    assert.isFalse(txns.hasPendingTxns);

    let newModelId: Id64String;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    // Find or create a SpatialCategory
    const dictionary = imodel.models.getModel(IModel.dictionaryId) as DictionaryModel;
    let spatialCategoryId: Id64String | undefined = SpatialCategory.queryCategoryIdByName(dictionary.iModel, dictionary.id, "MySpatialCategory");
    if (undefined === spatialCategoryId) {
      spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, "MySpatialCategory", new SubCategoryAppearance({ color: ColorByName.darkRed }));
    }

    const props: GeometricElementProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model: newModelId,
      category: spatialCategoryId,
      code: Code.createEmpty(),
      intProperty: 100,
    };

    const change1Msg = "change 1";
    const change2Msg = "change 2";
    let beforeUndo = 0;
    let afterUndo = 0;
    let undoAction = TxnAction.None;

    txns.onBeforeUndoRedo.addListener(() => afterUndo++);
    txns.onAfterUndoRedo.addListener((action) => { beforeUndo++; undoAction = action; });

    let elementId = imodel.elements.insertElement(props);
    assert.isFalse(txns.isRedoPossible);
    assert.isFalse(txns.isUndoPossible);
    assert.isTrue(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);

    imodel.saveChanges(change1Msg);
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isTrue(txns.hasPendingTxns);
    assert.isTrue(txns.hasLocalChanges);

    let element = imodel.elements.getElement(elementId);
    assert.equal(element.intProperty, 100, "int property should be 100");

    assert.isTrue(txns.isUndoPossible);  // we have an undoable Txn, but nothing undone.
    assert.equal(change1Msg, txns.getUndoString());
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.isTrue(txns.isRedoPossible);
    assert.equal(change1Msg, txns.getRedoString());
    assert.equal(beforeUndo, 1);
    assert.equal(afterUndo, 1);
    assert.equal(undoAction, TxnAction.Reverse);

    assert.throws(() => imodel.elements.getElement(elementId), IModelError);

    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.isTrue(txns.isUndoPossible);
    assert.isFalse(txns.isRedoPossible);
    assert.equal(beforeUndo, 2);
    assert.equal(afterUndo, 2);
    assert.equal(undoAction, TxnAction.Reinstate);

    element = imodel.elements.getElement(elementId);
    element.intProperty = 200;
    element.update();

    imodel.saveChanges(change2Msg);
    element = imodel.elements.getElement(elementId);
    assert.equal(element.intProperty, 200, "int property should be 200");
    assert.equal(txns.getTxnDescription(txns.queryPreviousTxnId(txns.getCurrentTxnId())), change2Msg);

    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    element = imodel.elements.getElement(elementId);
    assert.equal(element.intProperty, 100, "int property should be 100");

    // make sure abandon changes works.
    element.delete();
    assert.throws(() => imodel.elements.getElement(elementId), IModelError);
    imodel.abandonChanges(); //
    element = imodel.elements.getElement(elementId); // should be back now.

    elementId = imodel.elements.insertElement(props); // create a new element
    assert.isTrue(txns.hasUnsavedChanges);
    assert.equal(IModelStatus.Success, txns.reverseSingleTxn());
    assert.isFalse(txns.hasUnsavedChanges);
    assert.throws(() => imodel.elements.getElement(elementId), IModelError); // reversing a txn with pending uncommitted changes should abandon them.
    assert.equal(IModelStatus.Success, txns.reinstateTxn());
    assert.throws(() => imodel.elements.getElement(elementId), IModelError); // doesn't come back, wasn't committed

    assert.equal(IModelStatus.Success, txns.cancelTo(txns.queryFirstTxnId()));
    assert.isFalse(txns.hasUnsavedChanges);
    assert.isFalse(txns.hasPendingTxns);
    assert.isFalse(txns.hasLocalChanges);
  });
});
