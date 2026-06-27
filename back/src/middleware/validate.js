// Validates a request part (body/query/params) against a Zod schema and
// replaces it with the parsed (typed/coerced) value.
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    req[source] = result.data;
    next();
  };
}
