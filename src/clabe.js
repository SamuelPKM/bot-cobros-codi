// Validación de CLABE (Clave Bancaria Estandarizada): 18 dígitos, el último es
// un dígito verificador. Se revisa antes de mandarla a pey para dar un error
// claro y no gastar una llamada.
//
// Algoritmo de Banxico: cada uno de los primeros 17 dígitos se multiplica por
// 3, 7, 1, 3, 7, 1, ...; de cada producto se toma el último dígito; se suman, y
// el verificador es (10 - (suma mod 10)) mod 10.

const WEIGHTS = [3, 7, 1];

export function clabeCheckDigit(first17) {
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += (Number(first17[i]) * WEIGHTS[i % 3]) % 10;
  return (10 - (sum % 10)) % 10;
}

export function isValidClabe(clabe) {
  return /^[0-9]{18}$/.test(clabe) && clabeCheckDigit(clabe) === Number(clabe[17]);
}
