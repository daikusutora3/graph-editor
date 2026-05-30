export function createVerification(name: string) {
  const failures: string[] = [];

  function expect(condition: boolean, message: string) {
    if (!condition) {
      failures.push(message);
    }
  }

  function fail(message: string) {
    failures.push(message);
  }

  function finish(successMessage = `${name} verification passed`) {
    if (failures.length > 0) {
      console.error(`${name} verification failed (${failures.length})`);
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      process.exit(1);
    }

    console.log(successMessage);
  }

  return { expect, fail, finish };
}
