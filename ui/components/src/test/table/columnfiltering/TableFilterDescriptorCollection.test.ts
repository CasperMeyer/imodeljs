/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";

import { TestUtils, TestFilterableTable } from "../../TestUtils";
import { ColumnDescription, RowItem } from "../../../ui-components/table/TableDataProvider";
import { SimpleTableDataProvider } from "../../../ui-components/table/SimpleTableDataProvider";
import { TableColumn, ReactDataGridColumn } from "../../../ui-components/table/component/TableColumn";
import { StandardTypeConverterTypeNames } from "../../../ui-components/converters/TypeConverter";
import { FilterOperator, FilterCompositionLogicalOperator } from "../../../ui-components/table/columnfiltering/ColumnFiltering";

const columns: ColumnDescription[] = [
  {
    key: "lorem",
    label: "Lorem",
  },
  {
    key: "index",
    label: "Index",
    showDistinctValueFilters: false,
    showFieldFilters: false,
    filterCaseSensitive: true,
  },
];

// cSpell:ignore lorem

// cSpell:disable
const loremIpsum = [
  "Lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet,",
  "consectetur",
  "adipiscing",
  "elit,",
  "sed",
  "do",
];
// cSpell:enable

const createRow = (i: number) => {
  const row: RowItem = { key: i.toString(), cells: [] };
  const loremIndex = i % 10;
  row.cells.push({
    key: columns[0].key,
    record: TestUtils.createPropertyRecord(loremIpsum[loremIndex], columns[0], StandardTypeConverterTypeNames.Text),
  });
  row.cells.push({
    key: columns[1].key,
    record: TestUtils.createPropertyRecord(i, columns[1], StandardTypeConverterTypeNames.Integer),
  });
  return row;
};

const numTestRows = 100;

describe("TableFilterDescriptorCollection", () => {
  let rows: RowItem[];
  let dataProvider: SimpleTableDataProvider;
  let testTable: TestFilterableTable;
  let columnDescriptions: ColumnDescription[];
  let filterableColumn0: TableColumn;
  let filterableColumn1: TableColumn;
  let columnDescription0: ColumnDescription;
  let columnDescription1: ColumnDescription;
  const onApplyFilterSpy = sinon.spy();

  const applyFilter = async (): Promise<void> => {
    if (dataProvider.applyFilterDescriptors) {
      await dataProvider.applyFilterDescriptors(testTable.filterDescriptors);
      onApplyFilterSpy();
    }
  };

  before(async () => {
    rows = new Array<RowItem>();
    for (let i = 1; i <= numTestRows; i++) {
      const row = createRow(i);
      rows.push(row);
    }
    testTable = new TestFilterableTable(columns);
    dataProvider = new SimpleTableDataProvider(columns);
    dataProvider.setItems(rows);
    columnDescriptions = await dataProvider.getColumns();
  });

  beforeEach(async () => {
    testTable.filterDescriptors.clear();
    await applyFilter();
    onApplyFilterSpy.resetHistory();

    columnDescription0 = columnDescriptions[0];
    const reactDataGridColumn0: ReactDataGridColumn = {
      key: columnDescription0.key,
      name: columnDescription0.label,
    };
    filterableColumn0 = new TableColumn(testTable, columnDescription0, reactDataGridColumn0);
    columnDescription1 = columnDescriptions[1];
    const reactDataGridColumn1: ReactDataGridColumn = {
      key: columnDescription0.key,
      name: columnDescription0.label,
    };
    filterableColumn1 = new TableColumn(testTable, columnDescription1, reactDataGridColumn1);

    filterableColumn0.columnFilterDescriptor.distinctFilter.addDistinctValue("Lorem");
    filterableColumn0.columnFilterDescriptor.distinctFilter.addDistinctValue("ipsum");

    filterableColumn1.columnFilterDescriptor.fieldFilter.addFieldValue(10, FilterOperator.IsLessThan);
    filterableColumn1.columnFilterDescriptor.fieldFilter.addFieldValue(15, FilterOperator.IsEqualTo);
    filterableColumn1.columnFilterDescriptor.fieldFilter.addFieldValue(90, FilterOperator.IsGreaterThanOrEqualTo);
  });

  it("isColumnFilterActive should return proper value", () => {
    const filterDescriptors = testTable.filterDescriptors;
    expect(filterDescriptors.isColumnFilterActive("lorem")).to.be.true;
    expect(filterDescriptors.isColumnFilterActive("index")).to.be.true;
  });

  it("evaluateRow should return proper value - And", async () => {
    const filterDescriptors = testTable.filterDescriptors;
    filterDescriptors.logicalOperator = FilterCompositionLogicalOperator.And;
    let rowCount = await dataProvider.getRowsCount();
    expect(rowCount).to.eq(numTestRows);
    let passedCount = 0;
    for (let i = 0; i < rowCount; i++) {
      const rowItem = await dataProvider.getRow(i);
      const passed = filterDescriptors.evaluateRow(rowItem);
      if (passed)
        passedCount++;
    }
    expect(passedCount).to.eq(4);

    await dataProvider.applyFilterDescriptors(filterDescriptors);
    rowCount = await dataProvider.getRowsCount();
    expect(rowCount).to.eq(passedCount);
  });

  it("evaluateRow should return proper value - Or", async () => {
    const filterDescriptors = testTable.filterDescriptors;
    filterDescriptors.logicalOperator = FilterCompositionLogicalOperator.Or;
    let rowCount = await dataProvider.getRowsCount();
    expect(rowCount).to.eq(numTestRows);
    let passedCount = 0;
    for (let i = 0; i < rowCount; i++) {
      const rowItem = await dataProvider.getRow(i);
      const passed = filterDescriptors.evaluateRow(rowItem);
      if (passed)
        passedCount++;
    }
    expect(passedCount).to.eq(37);

    await dataProvider.applyFilterDescriptors(filterDescriptors);
    rowCount = await dataProvider.getRowsCount();
    expect(rowCount).to.eq(passedCount);

    filterDescriptors.logicalOperator = FilterCompositionLogicalOperator.And;
  });

  it("getFilterExpression should return ECExpression for the descriptor - And", () => {
    const filterDescriptors = testTable.filterDescriptors;
    filterDescriptors.logicalOperator = FilterCompositionLogicalOperator.And;
    const expression = filterDescriptors.getFilterExpression();
    expect(expression).to.eq(`(((lorem = "Lorem") Or (lorem = "ipsum"))) And (((index < "10") Or (index = "15") Or (index >= "90")))`);
  });

  it("getFilterExpression should return ECExpression for the descriptor - Or", () => {
    const filterDescriptors = testTable.filterDescriptors;
    filterDescriptors.logicalOperator = FilterCompositionLogicalOperator.Or;
    const expression = filterDescriptors.getFilterExpression();
    expect(expression).to.eq(`(((lorem = "Lorem") Or (lorem = "ipsum"))) Or (((index < "10") Or (index = "15") Or (index >= "90")))`);
  });

  it("getFilterExpression should return ECExpression for the descriptor - No Fields", () => {
    const filterDescriptors = testTable.filterDescriptors;
    filterDescriptors.logicalOperator = FilterCompositionLogicalOperator.And;
    filterableColumn1.columnFilterDescriptor.fieldFilter.clear();
    const expression = filterDescriptors.getFilterExpression();
    expect(expression).to.eq(`(((lorem = "Lorem") Or (lorem = "ipsum")))`);
  });

});