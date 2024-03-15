import { PothosSchemaError, PothosValidationError } from '../errors';
import { ListRef } from '../refs/list';
import { FieldNullability, InputType, OutputType, SchemaTypes, typeBrandKey } from '../types';

export * from './base64';
export * from './context-cache';
export * from './enums';
export * from './input';
export * from './params';
export * from './sort-classes';

export function assertNever(value: never): never {
  throw new TypeError(`Unexpected value: ${value}`);
}

export function assertArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    throw new PothosValidationError('List resolvers must return arrays');
  }

  return true;
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!(
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as Record<string, unknown>).then === 'function'
  );
}

export function verifyRef(ref: unknown) {
  if (ref === undefined) {
    throw new PothosSchemaError(`Received undefined as a type ref.

This is often caused by a circular import
If this ref is imported from a file that re-exports it (like index.ts)
you may be able to resolve this by importing it directly from the file that defines it.
`);
  }
}

export function verifyInterfaces(interfaces: unknown) {
  if (!interfaces || typeof interfaces === 'function') {
    return;
  }

  if (!Array.isArray(interfaces)) {
    throw new PothosSchemaError('interfaces must be an array or function');
  }

  for (const iface of interfaces) {
    if (iface === undefined) {
      throw new PothosSchemaError(`Received undefined in list of interfaces.

This is often caused by a circular import
If this ref is imported from a file that re-exports it (like index.ts)
you may be able to resolve this by importing it directly from the file that defines it.

Alternatively you can define interfaces with a function that will be lazily evaluated,
which may resolver issues with circular dependencies:

Example:
builder.objectType('MyObject', {
  interface: () => [Interface1, Interface2],
  ...
});
`);
    }
  }
}

export function brandWithType<Types extends SchemaTypes>(val: unknown, type: OutputType<Types>) {
  if (typeof val !== 'object' || val === null) {
    return;
  }

  Object.defineProperty(val, typeBrandKey, {
    enumerable: false,
    value: type,
  });
}

export function getTypeBrand(val: unknown) {
  if (typeof val === 'object' && val !== null && typeBrandKey in val) {
    return (val as { [typeBrandKey]: OutputType<SchemaTypes> })[typeBrandKey];
  }

  return null;
}

export function unwrapListParam<Types extends SchemaTypes>(
  param: InputType<Types> | OutputType<Types> | [InputType<Types>] | [OutputType<Types>],
): InputType<Types> | OutputType<Types> {
  if (Array.isArray(param)) {
    return unwrapListParam(param[0]);
  }

  if (param instanceof ListRef) {
    return unwrapListParam(param.listType as OutputType<Types>);
  }

  return param;
}

export function unwrapOutputListParam<Types extends SchemaTypes>(
  param: OutputType<Types> | [OutputType<Types>],
): OutputType<Types> {
  if (Array.isArray(param)) {
    return unwrapOutputListParam(param[0]);
  }

  if (param instanceof ListRef) {
    return unwrapOutputListParam(param.listType as OutputType<Types>);
  }

  return param;
}

export function unwrapInputListParam<Types extends SchemaTypes>(
  param: InputType<Types> | [InputType<Types>],
): InputType<Types> {
  if (Array.isArray(param)) {
    return unwrapInputListParam(param[0]);
  }

  if (param instanceof ListRef) {
    return unwrapInputListParam(param.listType as InputType<Types>);
  }

  return param;
}

/**
 * Helper for allowing plugins to fulfill the return of the `next` resolver, without paying the cost of the
 * Promise if not required.
 */
export function completeValue<T, R>(
  valOrPromise: PromiseLike<T> | T,
  onSuccess: (completedVal: T) => R,
  onError?: (errVal: unknown) => R,
): Promise<R> | R {
  if (isThenable(valOrPromise)) {
    return Promise.resolve(valOrPromise).then(onSuccess, onError);
  }
  // No need to handle onError, this should just be a try/catch inside the `onSuccess` block
  const result = onSuccess(valOrPromise);

  // If the result of the synchronous call is a promise like, convert to a promise
  // for consistency
  if (isThenable(result)) {
    return Promise.resolve(result);
  }
  return result;
}

export function nonNullableFromOptions<
  Types extends SchemaTypes,
  Nullable extends FieldNullability<[unknown]>,
>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  options: {
    nullable?: Nullable;
    nonNull?: Nullable;
  } = {},
): Nullable | boolean {
  if (options.nullable === true) {
    return false;
  }

  if (options.nullable === false) {
    return true;
  }

  if (options.nullable && typeof options.nullable === 'object') {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      list: !options.nullable.list,
      items: !options.nullable.items,
    } as never;
  }

  if (options.nonNull !== undefined) {
    return options.nonNull;
  }

  return !builder.defaultFieldNullability;
}
