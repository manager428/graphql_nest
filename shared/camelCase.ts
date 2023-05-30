export const camelCase = (input: string) =>
  input
    .toLowerCase()
    .replace(/-(.)/g, (_match, group1) => group1.toUpperCase());
