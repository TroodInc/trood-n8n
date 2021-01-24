const TroodABACEngine = require("./TroodABACEngine.node.ts");
const mocha = require("mocha"); // require mocha
const chai = require("chai"); // require chai

const expect = chai.expect;
const describe = mocha.describe;
const it = mocha.it;

describe("AbacEngine", () => {
  const resolver = new TroodABACEngine.TroodABACResolver(
    {},
    {
      sbj: {
        id: 10,
        login: "admin@demo.com",
        status: "active",
        role: "admin",
        profile: { id: 1, name: "John" },
      },
    },
    {},
    "allow"
  );

  describe("Operators", () => {
    describe("strings equal", () => {
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["eq"]("first", "second");
        expect(res["result"]).to.be.false;
      });
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["eq"]("same", "same");
        expect(res["result"]).to.be.true;
      });
    });

    describe("numbers equal", () => {
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["eq"](1, 2);
        expect(res["result"]).to.be.false;
      });
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["eq"](1, 1);
        expect(res["result"]).to.be.true;
      });
    });

    describe("Must check if value in array", () => {
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["in"]([1, 2, 3], 1);
        expect(res["result"]).to.be.true;
      });
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["in"]([1, 2, 3], 4);
        expect(res["result"]).to.be.false;
      });
    });

    describe("Must check if value in array", () => {
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["in"](["a", "b", "c"], "a");
        expect(res["result"]).to.equal(true);
      });
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["in"](["a", "b", "c"], "d");
        expect(res["result"]).false;
      });
    });

    describe("Reveal values from attr paths", () => {
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["in"](["a", "b", "c"], "a");
        expect(res["result"]).to.be.true;
      });
      it("should be able to add things correctly", () => {
        const res = TroodABACEngine.operatorsDict["in"](["a", "b", "c"], "d");
        expect(res["result"]).to.be.false;
      });
    });
  });

  describe("Reveal values from attr paths", () => {
    it("must reveal from Object", () => {
      const res = resolver.reveal("sbj.role", "admin");
      expect(res.operand).to.equal("admin");
      expect(res.value).to.equal("admin");
      expect(res.isFilter).to.equal(false);
    });
    it("must reveal from map", () => {
      const res = resolver.reveal("obj.owner", "sbj.profile.id");
      expect(res.operand).to.equal("owner");
      expect(res.value).to.equal(1);
      expect(res.isFilter).to.equal(true);
    });
    it("must reveal non-existing properties as null", () => {
      const res = resolver.reveal("sbj.some.nonexisting.prop", "sbj.another");
      expect(Object.keys(res.operand).length === 0).to.equal(true);
      expect(Object.keys(res.value).length === 0).to.equal(true);
      expect(res.isFilter).to.equal(false);
    });
  });

  describe("Rules", () => {
    it("must evaluate sbj EQ condition", () => {
      const res = resolver.evaluateCondition({ "sbj.role": "admin" });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate sbj IN condition", () => {
      const res = resolver.evaluateCondition({
        "sbj.role": { in: ["manager", "admin"] },
      });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate sbj NOT condition", () => {
      const res = resolver.evaluateCondition({
        "sbj.role": { not: "manager" },
      });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate OR sbj condition", () => {
      const res = resolver.evaluateCondition({
        or: [{ "sbj.role": { not: "manager" } }, { "sbj.id": 5 }],
      });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate AND sbj condition", () => {
      const res = resolver.evaluateCondition({
        and: [{ "sbj.role": { not: "manager" } }, { "sbj.id": 10 }],
      });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate and or condition", () => {
      const res = resolver.evaluateCondition({
        or: [
          { "obj.executor.account": "sbj.id" },
          { "obj.responsible.account": "sbj.id" },
        ],
        "sbj.role": "admin",
      });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate wildcard value", () => {
      const res = resolver.evaluateCondition({ "sbj.role": "*" });
      expect(res["passed"]).to.equal(true);
    });
    it("must evaluate condition with null/non-existing arguments", () => {
      const res = resolver.evaluateCondition({
        "sbj.none.existing.field": null,
      });
      expect(res["passed"]).to.equal(true);
    });
  });

  describe("Building filter expression", () => {
    it("must evaluate sbj EQ condition", () => {
      const res = resolver.evaluateCondition({
        or: [
          { "obj.executor.account": "sbj.id" },
          { "obj.responsible.account": "sbj.id" },
        ],
        "sbj.role": "admin",
      });
      const value = res.filters[0].value;

      expect(value).to.have.lengthOf(2);
      expect(value[0].operand).to.equal("executor.account");
      expect(value[0].value).to.equal(10);
      expect(value[1].operand).to.equal("responsible.account");
      expect(value[1].value).to.equal(10);
    });
    it("Returns nil if there are no suitable rules to build filter expression", () => {
      const res = resolver.evaluateRule({ rule: { "sbj.role": "admin" } });
      expect(res.filter).to.equal(undefined);
    });
  });
});
