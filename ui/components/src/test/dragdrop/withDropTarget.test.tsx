/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { DragDropContext } from "react-dnd";
import TestBackend from "react-dnd-test-backend";
import ReactTestUtils from "react-dom/test-utils";
import * as sinon from "sinon";
import { cleanup, render } from "@testing-library/react";
import { DragSourceArguments, withDragSource, withDropTarget } from "../../ui-components";

describe("withDragSource", () => {

  /**
   * Wraps a component into a DragDropContext that uses the TestBackend.
   */
  function wrapInTestContext(DecoratedComponent: React.ComponentType<any>) {// eslint-disable-line @typescript-eslint/naming-convention
    class TestContextContainer extends React.Component {
      public render() {
        return <DecoratedComponent {...this.props} />;
      }
    }

    return DragDropContext(TestBackend)(TestContextContainer);
  }

  class TestComponent extends React.Component<any> {
    public render(): React.ReactNode {
      return <div> test </div>;
    }
  }
  afterEach(cleanup);

  describe("Wrapped component", () => {
    const testDragSource = withDragSource(TestComponent);
    const BaseComponent = testDragSource.DecoratedComponent; // eslint-disable-line @typescript-eslint/naming-convention
    it("mounts wrapped component", () => {
      render(<BaseComponent dragProps={{}} connectDragSource={(e: any) => e} />);
    });
  });
  describe("Drop functionality", () => {
    const testDropTarget = withDropTarget(TestComponent);
    const TestDragSource = withDragSource(testDropTarget); // eslint-disable-line @typescript-eslint/naming-convention
    const ContextTestDragSource = wrapInTestContext(TestDragSource) as any; // eslint-disable-line @typescript-eslint/naming-convention
    const onDragSourceBegin = sinon.spy((args: DragSourceArguments) => {
      args.dataObject = { test: true };
      return args;
    });
    const onDragSourceEnd = sinon.spy();
    const onDropTargetDrop = sinon.spy();
    const onDropTargetOver = sinon.spy();
    const canDropTargetDrop = sinon.spy(() => {
      return true;
    });
    const dragProps = { onDragSourceBegin, onDragSourceEnd, objectType: "test" };
    const dropProps = { onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes: ["test"] };
    const root = ReactTestUtils.renderIntoDocument(<ContextTestDragSource dragProps={dragProps} dropProps={dropProps} />);

    // Obtain a reference to the backend
    const backend = (root as any).getManager().getBackend();
    const dragSource = ReactTestUtils.findRenderedComponentWithType(root as any, TestDragSource) as any;
    const dropTarget = ReactTestUtils.findRenderedComponentWithType(root as any, testDropTarget) as any;
    backend.simulateBeginDrag([dragSource.getHandlerId()]);
    // simulateHover must be called twice
    backend.simulateHover([dropTarget.getHandlerId()]);
    backend.simulateHover([dropTarget.getHandlerId()]);
    backend.simulateDrop();
    it("calls onDropTargetOver correctly", () => {
      expect(onDropTargetOver).to.have.been.calledOnce;
      expect(onDropTargetOver).to.have.been.calledWith(sinon.match({ dataObject: { test: true } }));
    });
    it("calls onDropTargetDrop correctly", () => {
      expect(onDropTargetDrop).to.have.been.calledOnce;
      expect(onDropTargetDrop).to.have.been.calledWith(sinon.match({ dataObject: { test: true } }));
    });
  });
});
