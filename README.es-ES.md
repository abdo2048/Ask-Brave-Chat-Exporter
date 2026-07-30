

<h1 align="center">
  <br>
  <img width="430" height="215" alt="Página principal de Ask Brave Chat Exporter" src="https://github.com/user-attachments/assets/e097cac0-8ac3-4c69-a400-dfc0c8f94bec" />
  <br>
  Ask Brave Chat Exporter
  <br>
</h1>

<h4 align="center">Un userscript para navegador que exporta conversaciones de Ask Brave AI a formatos Markdown y HTML con estilos profesionales y funciones mejoradas.<br>
  (((Construido con herramientas de IA)))</h4>
<p align="center">
    
  </a>
</p>

&nbsp;

https://github.com/user-attachments/assets/82a15cfe-143a-4831-b41d-70eed53e0b09

&nbsp;

## Capturas de pantalla

<div align="center">
  <img src="https://github.com/user-attachments/assets/1d8fc990-4253-402a-8087-95cad625f5cf" width="49%" />
  &nbsp;
  <img src="https://github.com/user-attachments/assets/abda0ce0-c005-4b38-a45e-7dd7e430c38c" width="49%" />
</div>

&nbsp;

<div align="center">
  <img src="https://github.com/user-attachments/assets/58aed5ab-4e66-4f27-98c6-f3434f045e18" width="49%" />
  &nbsp;
  <img src="https://github.com/user-attachments/assets/74c9fd5d-62ab-4a09-9aeb-1b23282e6343" width="49%" />
</div>

&nbsp;

<div align="center">
  <img src="https://github.com/user-attachments/assets/a9b9ebb3-175f-4dcf-9ea1-78902aee3ce4" width="49%" />
  &nbsp;
  <img src="https://github.com/user-attachments/assets/4d3e0677-56bd-437b-95ea-7b5e9c7ef0e5" width="49%" />
</div>

&nbsp;

<div align="center">
  <img src="https://github.com/user-attachments/assets/e4a13af4-dbc5-4ca8-90f1-646ff86f750b" width="50%" />
</div>

## Características

### Funcionalidad principal
- **Exportación dual**: Exporta conversaciones a formatos Markdown (.md) y HTML (.html).
- **Títulos personalizados**: Edita el título de tu conversación antes de exportar.
- **Formato inteligente**: Conserva preguntas, respuestas, bloques de código y el formato original.

### Exportación Markdown
- Separadores con emojis para división visual de preguntas (`◤━━━━━━ Q# ━━━━━◥`)
- Reglas horizontales entre pares de pregunta y respuesta.
- Encabezado de metadatos con título y fecha de exportación.

### Exportación HTML
- **Sistema de temas profesional**
  - Cumple con estándares de accesibilidad WCAG AA+.
  - Soporte automático para modo oscuro (respeta la preferencia del sistema).
  - Tipografía fluida y responsiva.
  - Paleta de colores moderna (Slate + Indigo).

- **Funciones interactivas**
  - Tabla de contenidos lateral fija con resaltado de la sección activa.
  - Menú hamburguesa responsivo para móviles.
  - Botones de copiado para todos los bloques de código, tablas y preguntas.
  - Navegación con desplazamiento suave.

- **Tipografía**
  - Fuente Inter para texto principal e interfaz.
  - JetBrains Mono para bloques de código.
  - Tamaños de fuente y espaciados optimizados.

### ¿Cómo funciona?
- El script hace clic en los botones de copiar del chat para los mensajes del usuario y las respuestas de la IA, luego los recopila en un solo archivo Markdown con algún formato personalizado, después utiliza la biblioteca [Marked](https://github.com/markedjs/marked) para convertir el Markdown a HTML, y finalmente aplica un tema personalizado al HTML. Más información en [Detalles técnicos sobre cómo funciona el script y el comportamiento de Ask Brave](https://github.com/abdo2048/Ask-Brave-Chat-Exporter#technical-details-about-how-does-script-work-and-ask-brave-behavior)

## Instalación

### Requisitos
Necesitamos **Tampermonkey.**
¿Qué es? `Es una extensión de navegador que te permite ejecutar userscripts, que son pequeños programas que pueden personalizar sitios web añadiendo funciones o modificando las existentes.`

### Pasos

1. **Instalar Tampermonkey**
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
   - [Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

2. **Instalar el Script**
- **_Método 1 (Greasyfork):_** Ve a https://greasyfork.org/en/scripts/561042-ask-brave-chat-exporter y haz clic en el botón verde `Install this script`.
- **_Método 2 (GitHub):_**
   - Ve a la última versión del script [última versión del script]([https://github.com/abdo2048/Ask-Brave-Chat-Exporter/releases/tag/v1.2](https://github.com/abdo2048/Ask-Brave-Chat-Exporter/releases/latest))
   - Debajo de **Assets**, haz clic derecho para copiar el enlace del script  `Ask.Brave.Chat.Exporter.x.js`
   - Abre Tampermonkey y pega el enlace del script en el campo "Import from URL" en la pestaña Utilities como se [muestra aquí en esta guía](https://gist.github.com/jesterjunk/0344f1a7c1f67f52ffc716b17ee7f240)

3. **Ir a Brave Ask**
   - Visita [search.brave.com/ask](https://search.brave.com/ask)
   - El botón de exportación aparecerá en la esquina inferior derecha.

## Uso

### Exportación básica

1. Abre cualquier conversación de Brave Ask (o inicia una nueva)
2. Haz clic en el botón **Export** (esquina inferior derecha)
3. Edita el título (opcional)
4. Selecciona el formato(s) de exportación:
   - Markdown
   - HTML
   - Ambos (predeterminado)
5. Haz clic en **Download**

### Formatos de exportación

#### Markdown (.md)
```markdown
---
**Título:** Título de tu conversación
**Exportado:** Lunes 30-12-2025 , 01:55 PM

---
◤━━━━━━ Q1 ━━━━━◥
¿Cuáles son los tipos de café más conocidos?
◣━━━━━━ Q1 ━━━━━◢

Los tipos de café más conocidos...

---
```

#### HTML (.html)
- Archivo independiente con CSS y JavaScript incrustados
- Optimizado para móviles e impresión
- El modo oscuro se activa automáticamente según la preferencia del sistema

## 🛑 Notas
- Al ejecutar el script, el navegador puede preguntarte si deseas permitir que el script use tu portapapeles. Debes presionar **Allow** para que el script pueda copiar los mensajes del usuario y las respuestas de la IA al portapapeles.
  - <img width="49%" alt="brave_tHOfxefFbvi" src="https://github.com/user-attachments/assets/163137af-ddb7-4545-bd02-10db670be13c" />

- Si encuentras algún error o algo extraño, abre un issue. 
- Al reportar errores, incluye:
  - Nombre del navegador.
  - URL de ejemplo para compartir la conversación (si es posible).
  - Mensajes de error de la consola si corresponde (F12 → Console).

## Hoja de ruta
**⚠️ Actualmente el script está en la Fase 1, y no estoy seguro si agregaré más funciones o lo mejoraré, pero esto es lo que creo que se verá el script:**

### Fase 2
- **Integración de URL de compartido**: Incluir la URL de compartido de la conversación de Brave Ask en las exportaciones mediante extracción automática o entrada manual por el usuario en el menú de exportación.
- **Metadatos HTML editables**: Permitir editar el título y la URL directamente en los archivos HTML exportados.
- **Exportación PDF**: Generación optimizada de PDF imprimible (barra lateral eliminada, diseño limpio).

### Fase 3
- **Sección de recursos**: Anexar fuentes (resultados web, videos, noticias, citas) al final de los archivos exportados.
- **Exportación masiva**: Exportar múltiples conversaciones en una sola operación.
- **Opciones de exportación configurables**: Alternar qué incluir (Tabla de contenidos, metadatos, recursos, etc.)
- **Convertidor independiente**: Binario preconstruido para convertir cualquier Markdown de chat a HTML usando este tema:
  - Funciona con cualquier archivo markdown (no solo exportaciones de Brave).
  - Operación sin conexión, sin dependencias.
  - Aplicar estilos personalizados a archivos markdown existentes.

## Contribuir, sugerencias o simplemente saludar

No dudes en enviar issues o pull requests.

## Detalles técnicos sobre cómo funciona el script y el comportamiento de Ask Brave (aún trabajando en esta sección)

### Dependencias
- **marked.js**: Conversión de Markdown a HTML
- **Fuente Inter**: Tipografía de la interfaz
- **JetBrains Mono**: Tipografía de bloques de código
