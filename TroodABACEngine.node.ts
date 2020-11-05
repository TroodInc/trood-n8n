interface FilterExpression {
	operator: string;
	operand?:  string;
	value: unknown;
}

interface TroodABACEngine {
	operand: unknown;
	value: unknown;
	isFilter: boolean;
}

interface RuleABAC {
	mask?: string[];
	filter?: FilterExpression;
	result?: string;
	passed?: boolean;
}

export interface InRule {
	[key:string]: unknown;
}


interface OperatorResult {
	result: boolean;
	filter?:  FilterExpression;
}

interface ResolverResult {
	filters?: FilterExpression[];
	filter?: FilterExpression;
	result?: string;
	passed?: boolean;
	mask?: string[];
}


function instanceOfInRule(object: object): object is InRule {
	return 'key:string' in object;
}

export class TroodABACResolver {
	subject?: InRule;
	context?: InRule;
	dataSource?: InRule;
	rulesTree?: InRule;
	defaultResolution? : string;

	constructor(subject: InRule, dataSource: InRule, defaultResolution: string) {
		this.subject = subject;
		this.dataSource = dataSource;
		this.defaultResolution = defaultResolution;
	}

	Check(resource: string, action: string): RuleABAC{
		const rules = this.findRules(resource, action);

		rules.forEach((rule: InRule) => {
			const res = this.evaluateRule(rule);
			if (res.passed){
				return {passed: res.result === "allow", filter: res.filter, mask: res.mask};
			}
		});
		return {passed: this.defaultResolution === "allow"};
	}


	evaluateRule(rule: InRule): ResolverResult {
		const condition = rule["rule"];
		const resolverResult = this.evaluateCondition((condition as InRule));

		if (rule["mask"] !== undefined){
			(rule["mask"] as InRule[]).forEach((val) =>[
				resolverResult.mask!.push(val as unknown as string)
			]);
		}

		if (resolverResult.filters !== null){
			resolverResult.filter = {operator: andOperator, operand: "", value: resolverResult.filters};
		}

		resolverResult.result = (rule["result"] as string);
		return resolverResult;
	}

	evaluateCondition(condition: InRule): ResolverResult {
		let operator = "exact";
		let totalResult = true;
		const filters = new Array<FilterExpression>();
		let value = "";
		let operatorResult = {} as OperatorResult;

		for (const operand of Object.keys(condition)) {
			if (instanceOfInRule((condition[operand]) as object)) {
				operator = (condition[operand] as string);
				value = operand;
			} else if (condition[operand]) {
				operator = operand;
			} else {
				operator = eqOperator;
			}

			const opt = this.reveal(operand, value);

			if (opt.isFilter) {
				filters.push(makeFilter(operator, operand, value));
			} else {

				if (operator === orOperator || operator === andOperator ){
					// @ts-ignore
					operatorResult = OperatorsSet.dynamicOperator(operator, value, this);
				} else {
					// @ts-ignore
					operatorResult = OperatorsSet.dynamicOperator(operator, value, operand);
				}

			}
			filters.push(operatorResult.filter!);
			totalResult = totalResult && operatorResult.result;
		}

		return {filters, passed: totalResult};
	}

	reveal(operand: unknown, value: unknown): TroodABACEngine {

		let isFilter = false;

		let split = (operand as string).split(".");

		if (split[0] === "obj"){
			operand = split[1];
			isFilter = true;
		} else if (split[0] === "obj" || split[0] === "ctx"){
			value = getAttributeByPath(this.dataSource![split[0]], split[1]);
		}


		if ((typeof value) === "string"){
			split = (value as string).split(".");
			if (split[0] === "obj" || split[0] === "ctx") {
				operand = getAttributeByPath(this.dataSource![split[0]], split[1]);
			}
		}

		return {operand, value, isFilter};
	}


	findRules(resource: string, action: string): InRule[]{
		const rules = new Array<InRule>();
		const actionBase = action.split("_");

		const paths = [resource + "." + action, resource + "." + actionBase[0] + "_*", resource + ".*",
			"*." + action, "*." + actionBase[0] + "_*", "*.*"];

		paths.forEach(path => {
			const val = getAttributeByPath(this.rulesTree, path);
			rules.push(val);
		});

		return rules;
	}
}


function makeFilter(operator: string, operand: string, value: unknown): FilterExpression{
	if ((typeof value) === "object"){
		for (const oper of Object.keys(value as object)){
			operator = oper;
			value = (value as InRule)[oper];
			break;
		}
	}
	return {operator, operand, value};
}


function getAttributeByPath(obj: unknown, path: string):InRule {
	const parts = path.split(".");
	const current = (obj as InRule)[parts[0]];

	if ((parts.length) === 1){
		return {path: obj, success: true};
	} else if (((parts.length) === 1)){
		return getAttributeByPath(current, parts[1]);
	}

	return {path: {}, success: false};
}

const andOperator = "and";
const orOperator = "or";
const inOperator = "in";
const eqOperator = "eq";
const notOperator = "not";
const ltOperator = "lt";
const gtOperator = "gt";

class OperatorsSet {
	dynamicOperator(member: Exclude<keyof OperatorsSet, "dynamicOperator">, value: unknown, operand: unknown): OperatorResult{
		return this[member](value,operand);
	}

	operator_exact(value: unknown, operand: unknown): OperatorResult{
		const result = (operand === value);
		return {result};
	}

	operator_not(value: unknown, operand: unknown): OperatorResult{
		const result = (operand !== value);
		return {result};
	}

	operator_in(value: unknown, operand: unknown): OperatorResult{
		const result = ((value as unknown[]).includes(operand));
		return {result};
	}

	operator_lt(value: unknown, operand: unknown): OperatorResult{
		const result = ((operand as number) < (value as number));
		return {result};
	}

	operator_gt(value: unknown, operand: unknown): OperatorResult{
		const result = ((operand as number) > (value as number));
		return {result};
	}

	operator_and(value: unknown, resolver: unknown): OperatorResult{
		const filters = new Array<FilterExpression>();
		let res = {} as ResolverResult;
		(value as InRule[]).forEach(condition => {
			res = (resolver as TroodABACResolver).evaluateCondition(condition);
			filters.push(res.filter!);
			if (!res.passed) {
				return {result: false};
			}
		});
		return {result: true, filter: {operator: andOperator, operand: "", value: filters}};
	}

	operator_or(value: unknown, resolver: unknown): OperatorResult{
		const filters = new Array<FilterExpression>();
		let res = {} as ResolverResult;
		(value as InRule[]).forEach(condition => {
			res = (resolver as TroodABACResolver).evaluateCondition(condition);
			filters.push(res.filter!);
			if (!res.passed) {
				return {result: false};
			}
		});
		return {result: true, filter: {operator: orOperator, operand: "", value: filters}};
	}
}
