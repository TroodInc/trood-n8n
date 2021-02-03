interface FilterExpression {
    operator: string;
    operand?: string;
    value: unknown;
}

interface TroodABACEngine {
    operand?: unknown;
    value?: unknown;
    isFilter?: boolean;
}

interface RuleABAC {
    mask?: string[];
    filter?: FilterExpression;
    result?: string;
    passed?: boolean;
}

export interface InRule {
    [key: string]: unknown;
}

export interface OperatorResult {
    result: boolean;
    filter?: FilterExpression;
}

interface ResolverResult {
    filters?: FilterExpression[];
    filter?: FilterExpression;
    result?: string;
    passed?: boolean;
    mask?: string[];
}

function instanceOfInRule(object: InRule): object is InRule {
    return "key:string" in object;
}

export class TroodABACResolver {
    subject?: InRule;
    context?: InRule;
    dataSource?: InRule;
    rulesTree?: InRule;
    defaultResolution?: string;

    constructor(
        subject: InRule,
        dataSource: InRule,
        rules: InRule,
        defaultResolution: string
    ) {
        this.subject = subject;
        this.dataSource = dataSource;
        this.rulesTree = rules;
        this.defaultResolution = defaultResolution;
    }

    Check(resource: string, action: string): RuleABAC {
        const rules = this.findRules(resource, action);

        rules.forEach((rule: InRule) => {
            const res = this.evaluateRule(rule);
            if (res.passed) {
                return {
                    passed: res.result === "allow",
                    filter: res.filter,
                    mask: res.mask,
                };
            }
        });
        return { passed: this.defaultResolution === "allow" };
    }

    evaluateRule(rule: InRule): RuleABAC {
        const condition = rule["rule"];
        const resolverResult = this.evaluateCondition(condition as InRule);

        if (rule["mask"] !== undefined) {
            (rule["mask"] as InRule[]).forEach((val) => [
                resolverResult.mask!.push((val as unknown) as string),
            ]);
        }

        if (
            resolverResult.filters !== undefined &&
            resolverResult.filters.length > 0
        ) {
            resolverResult.filter = {
                operator: "and",
                operand: "",
                value: resolverResult.filters,
            };
        }
        resolverResult.result = rule["result"] as string;
        return resolverResult;
    }

    evaluateCondition(condition: InRule): ResolverResult {
        let filters = [];
        let operator = "";
        let totalResult = true;
        let operatorResult = {} as OperatorResult;
        operatorResult.result = true;
        for (let [operand, value] of Object.entries(condition)) {
            if (Array.isArray(value)) {
                operator = operand;
            } else if (
                typeof value !== "string" &&
                typeof value !== "number" &&
                value !== null
            ) {
                operator = Object.keys(value as InRule)[0];
                value = Object.entries(value as InRule)[0][1];
            } else {
                operator = "eq";
            }
            const opt = this.reveal(operand, value);
            if (opt.isFilter) {
                let filter = makeFilter(operator, opt.operand as string, opt.value);
                filters.push(filter);
            } else {
                if (
                    operator === "eq" ||
                    operator === "not" ||
                    operator === "lt" ||
                    operator === "gt"
                ) {
                    operatorResult = operatorsDict[operator](opt.value, opt.operand);
                } else {
                    if (operator === "in") {
                        operatorResult = operatorsDict[operator](opt.value, opt.operand);
                    } else {
                        operatorResult = operatorsDict[operator](opt.value, this);
                    }
                }
            }
            if (operatorResult.filter !== undefined) {
                filters.push(operatorResult.filter);
            }
            totalResult = totalResult && operatorResult.result;
        }
        return { filters: filters, passed: totalResult };
    }

    reveal(operand: unknown, value: unknown): TroodABACEngine {
        let isFilter = false;

        let split = splitOnce(operand as string, ".");
        if (split[0] === "obj") {
            operand = split[1];
            isFilter = true;
        } else if (split[0] === "sbj" || split[0] === "ctx") {
            operand = getAttributeByPath(this.dataSource![split[0]], split[1])[
                "path"
                ];
        }
        if (typeof value === "string") {
            let split = splitOnce(value as string, ".");

            if (split[0] === "sbj" || split[0] === "ctx") {
                value = getAttributeByPath(this.dataSource![split[0]], split[1])[
                    "path"
                    ];
            }
        }
        return { operand, value, isFilter };
    }

    findRules(resource: string, action: string): InRule[] {
        const rules = new Array<InRule>();
        const actionBase = action.split("_");

        const paths = [
            resource + "." + action,
            resource + "." + actionBase[0] + "_*",
            resource + ".*",
            "*." + action,
            "*." + actionBase[0] + "_*",
            "*.*",
        ];

        paths.forEach((path) => {
            const val = getAttributeByPath(this.rulesTree, path);
            rules.push(val);
        });

        return rules;
    }
}

function makeFilter(
    operator: string,
    operand: string,
    value: unknown
): FilterExpression {
    if (typeof value === "object") {
        operator = Object.keys(value as InRule)[0];
        value = Object.entries(value as InRule)[0][1];
    }
    return { operator, operand, value };
}

function splitOnce(s: string, on: string) {
    let [first, ...rest] = s.split(on);
    if (rest.length > 0) {
        return [first, rest.join(on)];
    }
    return [first];
}

export function getAttributeByPath(obj: unknown, path: string): InRule {
    let parts = splitOnce(path, ".");
    const current = (obj as InRule)[parts[0]];
    if (current !== undefined) {
        if (parts.length === 1) {
            return { path: current };
        } else if (parts.length === 2) {
            return getAttributeByPath(current, parts[1]);
        }
    }
    return { path: {} };
}

export const operatorsDict: { [key: string]: Function } = {
    eq: (value: unknown, operand: unknown): OperatorResult => {
        if (value === "*" || value === null) {
            const result = true;
            return { result };
        }
        const result = operand === value;
        return { result };
    },
    not: (value: unknown, operand: unknown): OperatorResult => {
        const result = operand !== value;
        return { result };
    },
    in: (value: unknown, operand: unknown): OperatorResult => {
        const result = (value as unknown[]).includes(operand);
        return { result };
    },
    lt: (value: unknown, operand: unknown): OperatorResult => {
        const result = (operand as number) < (value as number);
        return { result };
    },
    gt: (value: unknown, operand: unknown): OperatorResult => {
        const result = (operand as number) > (value as number);
        return { result };
    },
    and: (value: unknown, resolver: unknown): OperatorResult => {
        const filters = new Array<FilterExpression>();
        let res = {} as ResolverResult;
        let result = true;
        (value as InRule[]).forEach((condition) => {
            res = (resolver as TroodABACResolver).evaluateCondition(condition);
            if (res.filters !== undefined) {
                filters.push(...res.filters);
            }
            if (!res.passed) {
                result = false;
            }
        });
        return {
            result: result,
            filter: { operator: "and", operand: "", value: filters },
        };
    },
    or: (value: unknown, resolver: unknown): OperatorResult => {
        let filters = new Array<FilterExpression>();
        let res = {} as ResolverResult;
        let result = false;
        (value as InRule[]).forEach((condition) => {
            res = (resolver as TroodABACResolver).evaluateCondition(condition);
            if (res.filters !== undefined) {
                filters.push(...res.filters);
            }
            if (res.passed) {
                result = true;
            }
        });
        return {
            result: result,
            filter: { operator: "or", operand: "", value: filters },
        };
    },
};
