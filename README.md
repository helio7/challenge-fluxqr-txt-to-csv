# Flux Challenge

Crear una aplicación en Javascript (puede ser un CLI, una webapp, una API) que pueda parsear un archivo TXT y generar un CSV y viceversa.

## Solución:

Decidí hostear una página web en la que el usuario puede enviar un archivo de entrada, y descargar el archivo de salida.
La página web es una aplicación de React hosteada con AWS Amplify.
El servidor que procesa y retorna el archivo es una aplicación de Express hosteada con AWS Elastic Beanstalk.

![alt text](https://raw.githubusercontent.com/helio7/challenge-fluxqr-txt-to-csv/main/FluxQR%20-%20TXT%20-%20CSV%20-%20API.png)

## Cómo testear:

- Ir a la página de la aplicación web:
https://main.d1nnf11og4mfvo.amplifyapp.com/

- Hacer click en 'Choose file'.
- Seleccionar el archivo de entrada.
  - El nombre del archivo debe seguir el formato 'FLUX_FECHA', siendo FECHA una fecha en formato DDMMAAAA.
  - La extensión del archivo puede ser .txt, o .csv.
  - Obviamente el contenido del archivo debe cumplir con las reglas detalladas en la descripción de este challenge.
  - Podés probar con los archivos FLUX en la raíz de este repositorio, son válidos.
- Hacer click en 'Submit'.
- Durante los próximos 5 segundos debería aparecer un botón que dice 'Download file'.
- Hacer click en 'Download file' para acceder al contenido del archivo de salida.
  - Si el archivo de salida es un .csv, el archivo se descargará automáticamente.
  - Si el archivo de salida es un .txt, su contenido se mostrará como un nuevo documento HTML.

- Recomiendo recargar la página cada vez que se envíe un nuevo archivo, ya que el botón 'Download file' no desaparece al seleccionar un nuevo archivo de entrada, y no sabrás cuando está listo el nuevo archivo de salida.
  
## Descripción del challenge.

Un ejemplo del archivo TXT a parsear es el siguiente:

`FLUX_<FECHA>.txt`
```
H07092021
RPA0000000100000709202120470000000000000000000000000000000012345679125695425500124300010000002000000000000000
RPA0000000200200709202120495500000000000000000000000000000012345779125695579100095000010000004004000000000000
RPA0000000155500709202121303300000000000000000000000000000012345879125695589900124300010000001555000000000000
RPA0000000090000709202121334500000000000000000000000000000012345979125695809300002200010000000900000000000000
RRV0000000090000709202121340000000000000000000000000000000012346079125695809400002200010000000000000000000000
RPA0000000060000709202122111100000000000000000000000000000012346179125695911000057100010000000600000000000000
RRE0000000005000709202122135000000000000000000000000000000012346279125695915000057100010000000000000000000000
RPA0000001000000709202122152000000000000000000000000000000012346379125696020114021100020000000000000000100000
F000008000000000151070
```

Transformado en CSV debería verse así:

```
type,amount,date,time,externalId,authorization,store,terminal,cashback,cashout
payment,100.00,07/09/2021,20:47:00,123456,791256954255,001243,0001,20.00,0
payment,200.20,07/09/2021,20:49:55,123457,791256955791,000950,0001,40.04,0
payment,155.50,07/09/2021,21:30:33,123458,791256955899,001243,0001,15.55,0
payment,90.00,07/09/2021,21:33:45,123459,791256958093,000022,0001,9.00,0
reversal,90.00,07/09/2021,21:34:00,123460,791256958094,000022,0001,0,0
payment,60.00,07/09/2021,22:11:11,123461,791256959110,000571,0001,6.00,0
refund,5.00,07/09/2021,22:13:50,123462,791256959150,000571,0001,0,0
payment,1000.00,07/09/2021,22:15:20,123463,791256960201,140211,0002,0,1000.00
```

## Descripción del archivo de conciliación

El archivo de conciliación que se quiere parsear así como los que se quieren generar siguen una lógica específica, la cual se detalla a continuación:

### Nombre del archivo

El nombre del archivo siempre deberá ser: `FLUX_<FECHA>.TXT` donde la fecha siga el siguiente formato: `DDMMAAAA` por lo que un archivo generado el 31 de Diciembre del 2021 debería ser: `FLUX_31122021.TXT`.


### Encabezado

La primera fila del archivo debe empezar con la letra `H` seguido de la fecha en el cual fue generado con el formato: `DDMMAAAA`.


### Registros

Cada línea debe representar una transacción, cada campo tiene longitudes específicas definidas por la siguiente tabla:


| Campo | Longitud | Descripción |
| :-----: | :------: | :-----------: |
| Bandera | 1 | Es un indicador que indica el comienzo de una fila nueva |
| Tipo transacción | 2 | Indica que tipo de transacción es: PA - Pago, RV - Reverso y RE - Devolución |
| Monto | 12 | El monto con centavos. Justificado a la derecha |
| Fecha | 8 | Fecha de la transacción, con el formato: `DDMMAAAA` |
| Hora | 6 | Hora de la transacción con el formato: `HHMMSS` |
| ID Interno | 36 | ID interno correspondiente a la transacción |
| Autorización | 12 | Número de autorización de la transacción |
| ID Sucursal | 6 | ID  de la sucursal que realizó la transacción |
| ID Terminal | 4 | ID de la terminal que realizó la transacción |
| Cashback | 10 | El monto con centavos. Justificado a la derecha |
| Cashout| 12 | El monto con centavos. Justificado a la derecha |

### Pie

La última fila deberá comenzar con la letra `F` seguido por el número de transacciones a 6 posiciones y justificado a la derecha; Y por último el monto total sumando los pagos y restando los reversos y devoluciones, el monto es con centavos a 15 posiciones y justificado a la derecha.


## Puntos a evaluar

Considere que el archivo CSV desde el cual se generará el archivo TXT de conciliación puede venir en desorden y es deseable que el archivo TXT venga ordenado por hora.

Bonus:

* Testing
* Documentación


NOTA: Se puede utilizar cualquier biblioteca o modulo de `npm`.
