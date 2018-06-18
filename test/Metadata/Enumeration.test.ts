/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import Enumeration from "../../source/Metadata/Enumeration";
import { ECObjectsError } from "../../source/Exception";
import { PrimitiveType } from "../../source/ECObjects";
import * as sinon from "sinon";

describe("Enumeration", () => {
  describe("deserialization", () => {
    it("minimum values", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testEnum: {
            schemaItemType: "Enumeration",
            backingTypeName: "string",
            description: "Test description",
            label: "Test Enumeration",
            isStrict: true,
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      const testEnum = await ecSchema.getItem<Enumeration>("testEnum");
      assert.isDefined(testEnum);

      if (!testEnum)
        return;

      expect(testEnum.description).equal("Test description");
      expect(testEnum.label).equal("Test Enumeration");
      expect(testEnum.isStrict).equal(true);
    });

    it("with enumerators", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testEnum: {
            schemaItemType: "Enumeration",
            backingTypeName: "integer",
            enumerators: [
              {
                name: "ZeroValue",
                value: 0,
                label: "None",
              },
            ],
          },
        },
      };

      const ecSchema = await Schema.fromJson(testSchema);
      const testEnum = await ecSchema.getItem<Enumeration>("testEnum");
      assert.isDefined(testEnum);
    });
  });

  describe("fromJson", () => {
    let testEnum: Enumeration;
    let testStringEnum: Enumeration;
    let testEnumSansPrimType: Enumeration;
    const baseJson = { schemaItemType: "Enumeration" };

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
      testStringEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.String);
      testEnumSansPrimType = new Enumeration(schema, "TestEnumeration");
    });

    describe("should successfully deserialize valid JSON", () => {
      function assertValidEnumeration(enumeration: Enumeration) {
        expect(enumeration.name).to.eql("TestEnumeration");
        expect(enumeration.label).to.eql("SomeDisplayLabel");
        expect(enumeration.description).to.eql("A really long description...");
        expect(enumeration.isStrict).to.be.false;
        expect(enumeration.enumerators).to.exist;
        expect(enumeration.enumerators.length).to.eql(2);
      }
      function assertValidIntEnumeration(enumeration: Enumeration) {
        assertValidEnumeration(enumeration);
        expect(enumeration.isInt()).to.be.true;
        expect(enumeration.isString()).to.be.false;
        expect(enumeration.getEnumerator(8)).to.exist;
        expect(enumeration.getEnumerator(8)!.label).to.eql("An enumerator label");
      }
      function assertValidStringEnumeration(enumeration: Enumeration) {
        assertValidEnumeration(enumeration);
        expect(enumeration.isInt()).to.be.false;
        expect(enumeration.isString()).to.be.true;
        expect(enumeration.getEnumerator("8")).to.exist;
        expect(enumeration.getEnumerator("8")!.label).to.eql("An enumerator label");
      }

      it("with backingTypeName first specified in JSON", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidIntEnumeration(testEnumSansPrimType);
      });

      it("with backingTypeName repeated in JSON", async () => {
        const json = {
          ...baseJson,
          backingTypeName: "int",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJson(json);
        assertValidIntEnumeration(testEnum);
      });

      it("with backingTypeName omitted in JSON", async () => {
        const json = {
          ...baseJson,
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: 6 },
            { name: "EightValue", value: 8, label: "An enumerator label" },
          ],
        };
        await testEnum.fromJson(json);
        assertValidIntEnumeration(testEnum);
      });

      it(`with backingTypeName="string"`, async () => {
        const json = {
          ...baseJson,
          backingTypeName: "string",
          isStrict: false,
          label: "SomeDisplayLabel",
          description: "A really long description...",
          enumerators: [
            { name: "SixValue", value: "6" },
            { name: "EightValue", value: "8", label: "An enumerator label" },
          ],
        };
        await testEnumSansPrimType.fromJson(json);
        assertValidStringEnumeration(testEnumSansPrimType);
      });
    });

    it("should throw for missing backingTypeName", async () => {
      expect(testEnumSansPrimType).to.exist;
      const json: any = { ...baseJson };
      await expect(testEnumSansPrimType.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration is missing the required 'backingTypeName' attribute.`);
    });

    it("should throw for invalid backingTypeName", async () => {
      expect(testEnum).to.exist;
      expect(testEnumSansPrimType).to.exist;
      let json: any = { ...baseJson, backingTypeName: 0 };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);
      await expect(testEnumSansPrimType.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'backingTypeName' attribute. It should be of type 'string'.`);

      json = { ...baseJson, backingTypeName: "ThisIsNotRight" };
      await expect(testEnumSansPrimType.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);
    });

    it("should throw for invalid isStrict", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, isStrict: 0 };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
    });

    it("should throw for mismatched backingTypeName", async () => {
      expect(testEnum).to.exist;
      let json: any = { ...baseJson, backingTypeName: "string" };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an incompatible backingTypeName. It must be "int", not "string".`);

      expect(testStringEnum).to.exist;
      json = { ...baseJson, backingTypeName: "int" };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an incompatible backingTypeName. It must be "string", not "int".`);
    });

    it("should throw for enumerators not an array", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: 0 };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
    });

    it("should throw for enumerators not an array of objects", async () => {
      expect(testEnum).to.exist;
      const json: any = { ...baseJson, enumerators: [0] };
      await expect(testEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
    });
  });

  describe("accept", () => {
    let testEnum: Enumeration;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
    });

    it("should call visitEnumeration on a SchemaItemVisitor object", async () => {
      expect(testEnum).to.exist;
      const mockVisitor = { visitEnumeration: sinon.spy() };
      await testEnum.accept(mockVisitor);
      expect(mockVisitor.visitEnumeration.calledOnce).to.be.true;
      expect(mockVisitor.visitEnumeration.calledWithExactly(testEnum)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitEnumeration defined", async () => {
      expect(testEnum).to.exist;
      await testEnum.accept({});
    });
  });
  describe("EC 3.2 Props", () => {
    const baseJson = { schemaItemType: "Enumeration" };
    let testIntEnum: Enumeration;
    let testStringEnum: Enumeration;

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testIntEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.Integer);
      testStringEnum = new Enumeration(schema, "TestEnumeration", PrimitiveType.String);
    });

    function assertValidIntEnumeration(enumeration: Enumeration, enumVal: number , label?: string, description?: string) {
      expect(enumeration.isInt()).to.be.true;
      expect(enumeration.isString()).to.be.false;
      expect(enumeration.getEnumerator(enumVal)).to.exist;
      if (typeof(label) !== undefined)
        expect(enumeration.getEnumerator(enumVal)!.label).to.eql(label);
      if (typeof(description) !== undefined)
        expect(enumeration.getEnumerator(enumVal)!.description).to.eql(description);
    }

    function assertValidStringEnumeration(enumeration: Enumeration, enumVal: string, label?: string, description?: string) {
      expect(enumeration.isInt()).to.be.false;
      expect(enumeration.isString()).to.be.true;
      expect(enumeration.getEnumerator(enumVal)).to.exist;
      if (typeof(label) !== undefined)
        expect(enumeration.getEnumerator(enumVal)!.label).to.eql(label);
      if (typeof(description) !== undefined)
        expect(enumeration.getEnumerator(enumVal)!.description).to.eql(description);
    }

    it("Duplicate name", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "SixValue", value: 8, label: "An enumerator label" },
        ],
      };
      await expect(testIntEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The enumerator SixValue has a duplicate name or value.`);
    });
    it("Duplicate value", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "EightValue", value: 6},
        ],
      };
      await expect(testIntEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The enumerator EightValue has a duplicate name or value.`);
    });
    it("Duplicate name and value", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "SixValue", value: 6 },
          { name: "SixValue", value: 6, label: "An enumerator label" },
        ],
      };
      await expect(testIntEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The enumerator SixValue has a duplicate name or value.`);
    });
    it("Basic test with number values", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "int",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "OneValue", value: 1, label: "Label for the first value", description: "description for the first value" },
          { name: "TwoValue", value: 2, label: "Label for the second value", description: "description for the second value" },
          { name: "ThreeValue", value: 3, label: "Label for the third value", description: "description for the third value" },
          { name: "FourValue", value: 4, label: "Label for the fourth value", description: "description for the fourth value" },
          { name: "FiveValue", value: 5, label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await testIntEnum.fromJson(json);
      assertValidIntEnumeration(testIntEnum, 3, "Label for the third value", "description for the third value");
    });
    it("Basic test with string values", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "OneValue", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "TwoValue", value: "two", label: "Label for the second value", description: "description for the second value" },
          { name: "ThreeValue", value: "three", label: "Label for the third value", description: "description for the third value" },
          { name: "FourValue", value: "four", label: "Label for the fourth value", description: "description for the fourth value" },
          { name: "FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await testStringEnum.fromJson(json);
      assertValidStringEnumeration(testStringEnum, "three", "Label for the third value", "description for the third value");
    });
    it("ECName comparison is case insensitive", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "ONEVALUE", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "onevalue", value: "two", label: "Label for the second value", description: "description for the second value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The enumerator onevalue has a duplicate name or value.`);
    });
    it("Description is not a string", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "ONEVALUE", value: "one", label: "Label for the first value", description: 1 },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator with an invalid 'description' attribute. It should be of type 'string'.`);
    });
    it("Get enumerator by name", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "OneValue", value: "one", label: "Label for the first value", description: "description for the first value" },
          { name: "TwoValue", value: "two", label: "Label for the second value", description: "description for the second value" },
          { name: "ThreeValue", value: "three", label: "Label for the third value", description: "description for the third value" },
          { name: "FourValue", value: "four", label: "Label for the fourth value", description: "description for the fourth value" },
          { name: "FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await testStringEnum.fromJson(json);
      expect(testStringEnum.getEnumeratorByName("OneValue")).to.exist;
      expect(testStringEnum.getEnumeratorByName("onevalue")!.description).to.eql("description for the first value");
      expect(testStringEnum.getEnumeratorByName("fourVALUE")!.label).to.eql("Label for the fourth value");
    });
    it("Name is required", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { value: "one", label: "Label for the first value", description: "Description for the first value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator that is missing the required attribute 'name'.`);
    });
    it("Value is required", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "one", label: "Label for the first value", description: "Description for the first value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The Enumeration TestEnumeration has an enumerator that is missing the required attribute 'value'.`);
    });
    it("Invalid ECName", async () => {
      const json = {
        ...baseJson,
        backingTypeName: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          {  name: "5FiveValue", value: "five", label: "Label for the fifth value", description: "description for the fifth value" },
        ],
      };
      await expect(testStringEnum.fromJson(json)).to.be.rejectedWith(ECObjectsError, ``);
    });
  });
});
