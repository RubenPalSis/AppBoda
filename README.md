# 💍 Iván & Ángela — App de fotos de la boda (PWA)

Aplicación web instalable (PWA) para que los invitados de la boda de **Iván y Ángela (7 de noviembre de 2026, Finca Sansui, Villanueva de Gállego)** suban, vean, descarguen y den ❤️ a las fotos del día.

- **Tecnología:** HTML + CSS + JavaScript vanilla (módulos ES) + Firebase (Hosting, Firestore, Authentication).
- **Gratis sí o sí:** funciona en el **plan Spark** de Firebase (sin tarjeta). No usa Cloud Storage: las fotos se guardan en Firestore.
- **Sin frameworks, sin Node.js en producción, sin build.** Node.js solo hace falta para usar la herramienta `firebase` (CLI) al desplegar.
- **Sin analítica, sin trackers, sin publicidad.** No se pide ni se guarda ningún dato personal de los invitados.
- **Proyecto de Firebase:** `appboda-ivan-angela` → URL pública: **<https://appboda-ivan-angela.web.app>**

---

## Índice

0. [Qué hace la app y cómo está hecha](#0-qué-hace-la-app-y-cómo-está-hecha)
1. [Estructura de archivos](#1-estructura-de-archivos)
2. [Estado actual: qué está hecho y qué falta](#2-estado-actual-qué-está-hecho-y-qué-falta)
3. [🚀 Configuración de Firebase paso a paso](#-configuración-de-firebase-paso-a-paso) ← **empieza aquí**
   - [Paso 1 — Abrir el proyecto, comprobar su ID y el plan Spark](#paso-1--abrir-el-proyecto-comprobar-su-id-y-el-plan-spark)
   - [Paso 2 — Registrar la aplicación web](#paso-2--registrar-la-aplicación-web)
   - [Paso 3 — Authentication para invitados (Anónimo)](#paso-3--authentication-para-invitados-anónimo)
   - [Paso 4 — Authentication para el administrador (Email/Password)](#paso-4--authentication-para-el-administrador-emailpassword)
   - [Paso 5 — Crear el usuario administrador](#paso-5--crear-el-usuario-administrador)
   - [Paso 6 — Crear Firestore Database](#paso-6--crear-firestore-database)
   - [Paso 7 — Dar permisos de administrador (colección admins)](#paso-7--dar-permisos-de-administrador-colección-admins)
   - [Paso 8 — Rellenar firebase-config.js](#paso-8--rellenar-firebase-configjs)
   - [Paso 9 — Comprobar .firebaserc](#paso-9--comprobar-firebaserc)
   - [Paso 10 — Instalar y conectar Firebase CLI](#paso-10--instalar-y-conectar-firebase-cli)
   - [Paso 11 — Desplegar las reglas y los índices](#paso-11--desplegar-las-reglas-y-los-índices)
   - [Paso 12 — Preparar Firebase Hosting](#paso-12--preparar-firebase-hosting)
   - [Paso 13 — Primer deploy](#paso-13--primer-deploy)
   - [Paso 14 — Comprobar la app publicada](#paso-14--comprobar-la-app-publicada)
4. [🔐 Pruebas de seguridad antes de la boda](#-pruebas-de-seguridad-antes-de-la-boda)
5. [💰 Costes y límites](#-costes-y-límites)
6. [💾 Backup antes y después de la boda](#-backup-antes-y-después-de-la-boda)
7. [📱 Código QR](#-código-qr)
8. [🖼️ Imagen de portada (heroImage)](#️-imagen-de-portada-heroimage)
9. Referencia
   - [Reglas de seguridad: qué permite cada una](#reglas-de-seguridad-qué-permite-cada-una)
   - [Código de acceso](#código-de-acceso)
   - [Configuración de la boda](#configuración-de-la-boda)
   - [Probar en local](#probar-en-local)
   - [Comprobación desde móvil](#comprobación-desde-móvil)
   - [PWA](#pwa)
   - [Comandos de despliegue habituales](#comandos-de-despliegue-habituales)
   - [Verificaciones técnicas realizadas](#verificaciones-técnicas-realizadas)
10. [Troubleshooting](#troubleshooting)
11. [Arquitectura final](#arquitectura-final)
12. [✅ Checklist final](#-checklist-final)

---

## 0. Qué hace la app y cómo está hecha

### Funcionalidades

| Invitados (`/`) | Administrador (`/admin.html`) |
|---|---|
| Acceso con código de la boda (se recuerda en el dispositivo) | Login con email y contraseña (Firebase Auth) |
| Portada con cuenta atrás | Nº total de fotos, likes, fotos de las últimas 24 h y espacio usado |
| Subida de 1 o varias fotos (hasta 20 por vez) | Ver todas las fotos (filtrar recientes, ordenar por fecha o likes) |
| Compresión automática en el móvil (máx. 1600 px y 450 KB por foto) | Descargar una foto |
| Galería en tiempo real (masonry, carga progresiva, lazy loading) | Seleccionar varias y descargarlas en ZIP |
| Visor a pantalla completa con deslizar ← → | 📦 DESCARGAR TODAS → `fotos-boda-ivan-angela.zip` |
| ❤️ Me gusta (uno por dispositivo, se puede quitar) | Eliminar cualquier foto (o varias a la vez) |
| ⬇️ Descargar foto | |
| 🗑️ Eliminar mis propias fotos | |
| Información de la boda (lugares, horarios, 📍 Cómo llegar) | |
| Instalable como app (Android e iPhone) | |

### La decisión de seguridad más importante: invitados con **Firebase Auth anónimo**

El enunciado pide que los invitados no se registren y que se genere un identificador aleatorio del dispositivo. Si ese identificador fuese solo un texto en `localStorage`, **cualquiera podría copiarlo o inventarlo** desde la consola del navegador y borrar fotos ajenas o sumar likes infinitos: las reglas de Firebase no tendrían forma de comprobar nada.

Por eso la app usa el **inicio de sesión anónimo de Firebase Authentication**:

- Al entrar con el código, el dispositivo obtiene automáticamente un **UID aleatorio** (p. ej. `Xk29sd...`). No pide nombre, email ni teléfono. Para el invitado es invisible.
- Ese UID viaja firmado en cada petición (`request.auth.uid`) y **no se puede falsificar**.
- Las reglas de seguridad comparan `ownerId` de cada foto con `request.auth.uid` → solo el dueño puede borrarla.
- El identificador legible `guest_<UID>` se guarda también en `localStorage`, tal y como pedía el enunciado.

El **código de acceso** (`IvAngela2026`) es solo una puerta de la interfaz: está en el JavaScript público y cualquiera con conocimientos técnicos podría leerlo. **La seguridad real la ponen las reglas de Firestore.**

### Cómo se almacenan las fotos

Para que la app sea **gratuita (plan Spark)**, no se usa Cloud Storage: todo se guarda en **Firestore**. Por cada foto, el móvil genera **dos imágenes ya comprimidas** (nunca sube el original) y las guarda en **dos documentos**, en un único lote atómico:

| Documento | Contenido | Tamaño típico | Uso |
|---|---|---|---|
| `photos/{photoId}` | Datos + **miniatura** (360 px) | 20–35 KB | Cuadrícula de la galería (lo único que se lee al navegar) |
| `photoFiles/{photoId}` | **Foto comprimida** (1600 px) | 200–450 KB (máx. 450 KB) | Visor, descargas, ZIP (solo se lee al abrirla) |

Si una foto pesa más de 450 KB, la app baja la calidad y, si hace falta, la resolución hasta que quepa. Así caben **~3.000 fotos** en el 1 GiB gratuito. Al redibujar la foto en el dispositivo, **se eliminan los metadatos EXIF (incluida la ubicación GPS)** y se corrige la orientación.

```javascript
// photos/{photoId}
{
  ownerId:   "<UID anónimo del dispositivo>",
  createdAt: Timestamp (hora del servidor),
  likes:     0,
  width: 1600, height: 1200, size: 312345,
  thumb:     Bytes (JPEG de la miniatura)
}
// photoFiles/{photoId}
{
  ownerId: "<UID anónimo del dispositivo>",
  data:    Bytes (JPEG de la foto)
}
```

Las imágenes se guardan como **bytes**, nunca como URLs. En el navegador se convierten en URLs locales `blob:`.

Likes: `photos/{photoId}/likes/{uid}` → el ID del documento es el UID, así que **es imposible que un dispositivo dé dos likes** a la misma foto.

### Librerías externas (todas gratuitas)

| Librería | Dónde | Por qué |
|---|---|---|
| Firebase JS SDK 10.12.2 (CDN oficial `gstatic.com`) | Toda la app | Obligatorio para usar Firebase sin instalar nada |
| JSZip 3.10.1 (CDN jsDelivr) | Solo en `/admin.html`, al pulsar descargar ZIP | El navegador no tiene API nativa para crear ZIP |
| Google Fonts (Cormorant Garamond + Montserrat) | CSS | Tipografías elegantes. Si prefieres no usar Google Fonts, borra las líneas `<link ... fonts.googleapis.com>` de `index.html` y `admin.html`: la app usará Georgia/fuentes del sistema |

---

## 1. Estructura de archivos

```text
AppBoda/
├── firebase.json            ← Configuración de Hosting, Firestore y emuladores
├── .firebaserc              ← ID del proyecto de Firebase (appboda-ivan-angela)
├── firestore.rules          ← Reglas de seguridad de Firestore
├── firestore.indexes.json   ← Excluye de los índices las imágenes (ahorra espacio)
├── storage.rules            ← (sin uso en plan Spark; se puede borrar)
├── cors.json                ← (sin uso en plan Spark; se puede borrar)
├── README.md
└── public/                  ← Lo que se publica en Firebase Hosting
    ├── index.html           ← App de invitados
    ├── admin.html           ← Panel de administración (sin enlace visible)
    ├── manifest.json        ← Manifiesto PWA
    ├── service-worker.js    ← Caché offline de la interfaz
    ├── css/
    │   ├── styles.css       ← Estilos de la app (y base del admin)
    │   └── admin.css        ← Estilos del panel
    ├── js/
    │   ├── wedding-config.js  ← ⭐ DATOS DE LA BODA (editar aquí)
    │   ├── firebase-config.js ← ⭐ CREDENCIALES DE FIREBASE (editar aquí)
    │   ├── auth.js          ← Código de acceso + sesión anónima
    │   ├── app.js           ← Arranque, navegación, cuenta atrás, info, PWA
    │   ├── photos.js        ← Capa de datos: subir/leer/borrar fotos
    │   ├── upload.js        ← Selección, compresión y subida
    │   ├── gallery.js       ← Galería y visor
    │   ├── likes.js         ← Me gusta
    │   ├── admin.js         ← Panel de administración + ZIP
    │   └── utils.js         ← Utilidades compartidas (toasts, diálogos, descargas…)
    └── assets/
        ├── icons/           ← Iconos PWA (192, 512, maskable, apple-touch, favicon, svg)
        └── images/          ← Pon aquí la imagen de portada si quieres una
```

---

## 2. Estado actual: qué está hecho y qué falta

La app está preparada para funcionar **gratis, siempre, en el plan Spark de Firebase** (sin tarjeta). Ver [💰 Costes y límites](#-costes-y-límites).

| Ya está hecho en el código | Lo tienes que hacer tú (consola de Firebase + terminal) |
|---|---|
| `.firebaserc` apunta a `appboda-ivan-angela` | Comprobar el ID del proyecto y que sigue en plan **Spark** ([Paso 1](#paso-1--abrir-el-proyecto-comprobar-su-id-y-el-plan-spark)) |
| `firebase-config.js` tiene `projectId` y `authDomain` | Copiar `apiKey`, `messagingSenderId` y `appId` desde la consola ([Paso 8](#paso-8--rellenar-firebase-configjs)) |
| Las fotos se guardan en **Firestore** (sin Cloud Storage, que exige plan de pago) | Activar Authentication y Firestore ([Pasos 3–6](#paso-3--authentication-para-invitados-anónimo)) |
| `firebase.json` listo (Hosting en `public/`, reglas, índices, cabeceras) | Crear el administrador y su documento en `admins` ([Pasos 5 y 7](#paso-5--crear-el-usuario-administrador)) |
| Reglas **probadas en el emulador (41 pruebas)** y app probada de principio a fin en un navegador (25 pruebas) | Desplegar y probar ([Pasos 10–14](#paso-10--instalar-y-conectar-firebase-cli)) |

> Mientras queden valores `TU_...` en `public/js/firebase-config.js`, la app muestra el aviso *"Falta configurar Firebase"* y no intenta conectarse. Es intencionado: así no se puede desplegar a medias sin darte cuenta.

---

# 🚀 Configuración de Firebase paso a paso

Esta guía empieza con el proyecto **`appboda-ivan-angela`** recién creado en Firebase y termina con la app publicada en **<https://appboda-ivan-angela.web.app>**, **sin tarjeta y sin coste**. Síguela **en orden**.

> **Regla de oro del plan gratuito:** si en algún momento la consola te pide **"Actualizar"**, **"Upgrade"**, **"Plan Blaze"** o una tarjeta, **NO lo aceptes**. Significa que estás entrando en un servicio que la app no usa (Storage, Functions, App Hosting…). Cancela y vuelve a la guía.

> **Idioma de la consola.** Los nombres de los botones se dan en español y, entre paréntesis, en inglés. Google cambia de vez en cuando la posición de los menús: si algo no está exactamente donde se indica, busca el mismo nombre en el menú izquierdo o en el buscador de la parte superior de la consola.

> **Lo que NO tienes que hacer:**
> - **No actives Storage**: las fotos van en Firestore.
> - No configures CORS.
> - No crees las colecciones `photos`, `photoFiles` ni `likes`: la app las crea sola.
> - No hace falta `npm install`, ni build, ni `firebase init`: el proyecto ya trae `firebase.json`.

---

### Paso 1 — Abrir el proyecto, comprobar su ID y el plan Spark

```text
PASO 1.1
Abre https://console.firebase.google.com con la cuenta de Google con la que creaste el proyecto.

PASO 1.2
En la lista de proyectos, pulsa la tarjeta "appboda-ivan-angela".

PASO 1.3
Arriba a la izquierda, junto a "Descripción general del proyecto" (Project Overview),
pulsa el icono ⚙️ → "Configuración del proyecto" (Project settings).

PASO 1.4
En la pestaña "General", busca el campo "ID del proyecto" (Project ID).

PASO 1.5
Abajo del todo en el menú izquierdo aparece el plan actual. Debe decir:
   Spark  (Sin costo / No-cost)
   ✗ NO pulses "Actualizar" (Upgrade).
```

**Comprueba que el ID es exactamente `appboda-ivan-angela`.** El *nombre* del proyecto y su *ID* pueden ser distintos: si al crearlo el ID ya estaba ocupado, Firebase le añade un sufijo (por ejemplo `appboda-ivan-angela-1a2b3`).

- Si el ID es `appboda-ivan-angela` → todo correcto, sigue.
- Si el ID tiene un sufijo → usa **ese ID real** en todos los sitios donde esta guía pone `appboda-ivan-angela`. En concreto tendrás que cambiarlo en `.firebaserc`, en `projectId` y `authDomain` de `public/js/firebase-config.js` y en las URLs (`https://<ID>.web.app`).

> **¿Por qué Spark es "gratis sí o sí"?** En Spark no hay ninguna forma de pago asociada, así que Google **no puede cobrarte nada**. Si algún día se superase un límite gratuito, el servicio afectado dejaría de responder hasta que se renueve la cuota, pero nunca se generaría una factura. Ver [qué pasa si se supera un límite](#qué-pasa-si-se-supera-un-límite).

---

### Paso 2 — Registrar la aplicación web

```text
PASO 2.1
Pulsa "Descripción general del proyecto" (Project Overview) en el menú izquierdo.

PASO 2.2
En el centro de la página verás "Agrega Firebase a tu app para comenzar"
con varios iconos redondos: iOS, Android, </> , Unity, Flutter.
PULSA el icono  </>  (Web).

   Si ya registraste otra app y no ves esos iconos:
   ⚙️ → Configuración del proyecto → General → sección "Tus apps"
   → "Agregar app" (Add app) → icono </> (Web).

PASO 2.3
"Sobrenombre de la app" (App nickname):
   AppBoda Web

PASO 2.4
Casilla "Configurar también Firebase Hosting para esta app"
(Also set up Firebase Hosting for this app):
   ☐ NO la marques.
   (Hosting lo prepararemos en el Paso 12. Si la marcas por error no pasa nada grave,
    pero te mostrará instrucciones de "firebase init" que en este proyecto NO hay que seguir).

PASO 2.5
PULSA: "Registrar app" (Register app).
```

Firebase muestra ahora el bloque **"Agrega el SDK de Firebase"** (*Add Firebase SDK*), con dos opciones: **"Usar npm"** y **"Usar una etiqueta `<script>`"**. Elige cualquiera de las dos (la app no usa npm; solo necesitas los valores). Dentro verás algo así:

```javascript
// EJEMPLO: tus valores serán distintos
const firebaseConfig = {
  apiKey: "AIzaSy...............................",
  authDomain: "appboda-ivan-angela.firebaseapp.com",
  projectId: "appboda-ivan-angela",
  storageBucket: "appboda-ivan-angela.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:0a1b2c3d4e5f6a7b8c9d0e"
};
```

```text
PASO 2.6
Copia a un sitio temporal (o deja esta pestaña abierta) estos TRES valores:
   apiKey
   messagingSenderId
   appId
Los pegarás en public/js/firebase-config.js en el Paso 8.

   ✗ storageBucket: NO lo necesitas. La app no usa Cloud Storage.
   ✗ measurementId (si aparece): NO lo copies. Es de Google Analytics, que la app no usa.
   ✗ No copies el bloque "import { initializeApp } ..." ni "npm install firebase":
     el proyecto ya carga el SDK 10.12.2 desde el CDN.

PASO 2.7
PULSA: "Ir a la consola" (Continue to console).
```

> **¿Dónde vuelvo a ver estos valores?** ⚙️ → **Configuración del proyecto** → pestaña **General** → baja hasta **"Tus apps"** → *AppBoda Web* → apartado **"Configuración y SDK"** (*SDK setup and configuration*) → opción **Config**.

> **¿Son secretos?** No. Toda app web de Firebase expone estos valores en su JavaScript: identifican el proyecto, no dan permisos. Lo que protege los datos son las **reglas de seguridad**. Por eso pueden ir en `firebase-config.js` y en Git.

---

### Paso 3 — Authentication para invitados (Anónimo)

Los invitados no se registran: cada dispositivo obtiene automáticamente un **usuario anónimo** con un UID aleatorio que las reglas usan para saber quién ha subido cada foto (ver [sección 0](#0-qué-hace-la-app-y-cómo-está-hecha)).

```text
PASO 3.1
Menú izquierdo → "Compilación" (Build) → "Authentication".
   (En la consola nueva puede estar en "Seguridad" (Security) → "Authentication".)

PASO 3.2
PULSA: "Comenzar" (Get started).

PASO 3.3
Se abre la pestaña "Método de acceso" (Sign-in method) con la lista de proveedores:

   Proveedores nativos        Proveedores adicionales
   - Correo electrónico/…     - Google
   - Teléfono                 - Facebook
   - Anónimo                  - Apple, GitHub, Microsoft, ...

PULSA: "Anónimo" (Anonymous).

PASO 3.4
Activa el interruptor "Habilitar" (Enable).

SELECCIONA:
   ☑ Anónimo
   ☐ Google
   ☐ Facebook
   ☐ Teléfono      ← (además, el SMS no es gratuito)
   ☐ (ningún otro)

PULSA: "Guardar" (Save).
```

**Cómo comprobar que está activo:** en **Authentication → Método de acceso**, la tabla *"Proveedores de acceso"* muestra **Anónimo — Habilitado** (*Anonymous — Enabled*).

> Si la consola te ofrece **actualizar a "Identity Platform"** (*Upgrade to Firebase Authentication with Identity Platform*), **no lo hagas**: no hace falta. Y si alguna vez ves la opción **"Limpieza automática de cuentas anónimas"**, déjala desactivada (si se borran, los invitados no podrán eliminar las fotos que subieron; el admin sí).

---

### Paso 4 — Authentication para el administrador (Email/Password)

```text
PASO 4.1
En Authentication → "Método de acceso" (Sign-in method),
PULSA: "Agregar proveedor nuevo" (Add new provider).

PASO 4.2
PULSA: "Correo electrónico/contraseña" (Email/Password).

PASO 4.3
Verás dos interruptores:

   ☑ Correo electrónico/contraseña            ← ACTÍVALO
     (Email/Password)
   ☐ Vínculo de correo electrónico            ← DÉJALO DESACTIVADO
     (acceso sin contraseña / Email link)

PULSA: "Guardar" (Save).
```

**Comprobación:** la tabla de proveedores muestra ahora **Anónimo — Habilitado** y **Correo electrónico/contraseña — Habilitado**.

> **No desactives "Habilitar creación (registro)"** (*Authentication → Configuración → Acciones de usuario → Enable create (sign-up)*). Si la desactivas, los invitados **no podrán** obtener su sesión anónima y la app fallará al entrar. No es un riesgo: aunque alguien cree una cuenta con email usando la API, **sin documento en `admins` no tiene ningún permiso extra** (comprobado en las pruebas de reglas).

**Dominios autorizados:** en *Authentication → Configuración (Settings) → Dominios autorizados (Authorized domains)* deben aparecer `localhost`, `appboda-ivan-angela.firebaseapp.com` y `appboda-ivan-angela.web.app`. Vienen por defecto; no hay que añadir nada salvo que uses un dominio propio.

---

### Paso 5 — Crear el usuario administrador

Esta cuenta es la que usarás para entrar en **`https://appboda-ivan-angela.web.app/admin.html`** (estadísticas, borrar cualquier foto, descargar el ZIP). **Créala con tu propio email** y una contraseña segura. No hay ninguna cuenta de administrador predefinida en el código.

```text
PASO 5.1
Authentication → pestaña "Usuarios" (Users).

PASO 5.2
PULSA: "Agregar usuario" (Add user).

PASO 5.3
   Correo electrónico:  tu email real (lo necesitarás si olvidas la contraseña)
   Contraseña:          una contraseña robusta, 12 caracteres o más
                        ✗ NO la guardes en ningún archivo del proyecto ni en Git

PULSA: "Agregar usuario" (Add user).

PASO 5.4
En la tabla aparece la nueva fila. En la columna "UID de usuario" (User UID)
pasa el ratón sobre el valor y pulsa el icono de copiar.
Guárdalo: lo necesitas en el Paso 7.
```

Para un segundo administrador (por ejemplo, el otro novio) repite este paso con su email y el Paso 7 con su UID.

> **Recomendación:** usa `/admin.html` desde un navegador o perfil distinto del que uses como invitado. La sesión de Firebase se comparte en el mismo navegador: si entras como admin, ese navegador deja de ser el "invitado anónimo" que subió sus fotos (podrás seguir borrándolas como admin, pero no aparecerán como "Tuya").

---

### Paso 6 — Crear Firestore Database

En el plan gratuito, Firestore lo guarda **todo**: los datos de cada foto, su miniatura, la foto comprimida, los likes y la lista de administradores.

```text
PASO 6.1
Menú izquierdo → "Compilación" (Build) → "Firestore Database".
   (En la consola nueva: "Bases de datos y almacenamiento" (Databases & Storage) → "Firestore".)

PASO 6.2
PULSA: "Crear base de datos" (Create database).

PASO 6.3
Si pregunta por la edición:
   ◉ Edición Standard (Standard edition)
   ○ Edición Enterprise              ← NO (requiere plan de pago)

PASO 6.4
"ID de la base de datos" (Database ID):
   (default)          ← déjalo tal cual. NO pongas otro nombre.

PASO 6.5
"Ubicación" (Location):
   SELECCIONA:  europe-southwest1 (Madrid)

PASO 6.6
"Reglas de seguridad":
   ◉ Iniciar en modo de producción (Start in production mode)
   ○ Iniciar en modo de prueba     ← NUNCA

PULSA: "Crear" (Create).
```

**¿Por qué `(default)`?** La cuota gratuita de Firestore solo se aplica a la base de datos `(default)`, y la app usa esa.

**¿Por qué Madrid (`europe-southwest1`)?** Lo he comprobado en la documentación oficial de ubicaciones de Firestore:

- Es la región **más cercana** a Zaragoza/Villanueva de Gállego: menor latencia para la galería y la subida.
- Los datos (y por tanto **las fotos**) quedan **en la UE**.
- La **cuota gratuita** de Firestore es la misma en cualquier región.
- ⚠️ **La ubicación no se puede cambiar después.**

**Modo de producción** significa "todo denegado por defecto". Durante unos minutos la app no podrá leer nada, hasta que despliegues `firestore.rules` en el [Paso 11](#paso-11--desplegar-las-reglas-y-los-índices).

**¿Hay que crear colecciones a mano?** Solo una, `admins` (Paso 7), porque las reglas prohíben escribirla desde la app. Las demás **las crea la propia app automáticamente**:

| Colección | Qué guarda | ¿Quién la crea? |
|---|---|---|
| `photos/{photoId}` | Autor, fecha, likes, tamaño y **miniatura** (~20–35 KB) | La app, con la primera foto (`photos.js`) |
| `photoFiles/{photoId}` | La **foto comprimida** (máx. 450 KB) | La app, en el mismo lote que la anterior |
| `photos/{photoId}/likes/{uid}` | Un documento por cada ❤️ | La app, con el primer like (`likes.js`) |
| `admins/{uid}` | Quién es administrador | **Tú, a mano** ([Paso 7](#paso-7--dar-permisos-de-administrador-colección-admins)) |

No hay que crear índices a mano. La única consulta (`orderBy("createdAt", "desc")`) usa el índice automático, y `firestore.indexes.json` solo **excluye de los índices** los campos binarios (`thumb` y `data`), algo que se aplica solo al desplegar.

---

### Paso 7 — Dar permisos de administrador (colección admins)

Un usuario es administrador si **existe un documento con su UID** en la colección `admins`. Las reglas de Firestore lo comprueban. Nadie puede añadirse a sí mismo, porque la colección no se puede escribir desde la app.

```text
PASO 7.1
Firestore Database → pestaña "Datos" (Data).

PASO 7.2
PULSA: "+ Iniciar colección" (+ Start collection).

PASO 7.3
"ID de la colección" (Collection ID):
   admins
PULSA: "Siguiente" (Next).

PASO 7.4
"ID del documento" (Document ID):
   pega el UID del Paso 5.4          ← ✗ NO pulses "ID automático" (Auto-ID)

PASO 7.5
Añade un campo (Firestore no permite documentos vacíos):
   Campo (Field):  email
   Tipo (Type):    string
   Valor (Value):  tu email

PULSA: "Guardar" (Save).
```

**Comprobación:** en *Datos* aparece la colección `admins` con un documento cuyo ID es tu UID.

Si te equivocas de UID, al entrar en `/admin.html` verás *"Este usuario no es administrador. UID: …"*. Copia ese UID, borra el documento incorrecto y crea uno nuevo con el UID correcto.

---

### Paso 8 — Rellenar firebase-config.js

Abre **`public/js/firebase-config.js`**. Ahora mismo contiene esto (ya rellené `authDomain` y `projectId` porque se deducen del ID del proyecto):

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",                              // cópialo de la consola
    authDomain: "appboda-ivan-angela.firebaseapp.com",
    projectId: "appboda-ivan-angela",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",       // cópialo de la consola
    appId: "TU_APP_ID"                                 // cópialo de la consola
};
```

Sustituye **solo el texto entre comillas** con los valores que copiaste en el Paso 2:

| Línea en `firebase-config.js` | Valor que va dentro de las comillas | De dónde sale |
|---|---|---|
| `apiKey: "TU_API_KEY"` | El `apiKey` de la consola (empieza por `AIza`) | Paso 2 |
| `authDomain` | Ya puesto: `appboda-ivan-angela.firebaseapp.com` | Comprueba que coincide con la consola |
| `projectId` | Ya puesto: `appboda-ivan-angela` | Comprueba que coincide con el Paso 1 |
| `messagingSenderId: "TU_MESSAGING_SENDER_ID"` | El `messagingSenderId` (solo números) | Paso 2 |
| `appId: "TU_APP_ID"` | El `appId` (empieza por `1:`) | Paso 2 |

**No añadas `storageBucket`** aunque la consola lo muestre: la app no usa Cloud Storage.

Debe quedar con este aspecto (los valores de ejemplo **no son reales**, usa los tuyos):

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...tu-clave...",
    authDomain: "appboda-ivan-angela.firebaseapp.com",
    projectId: "appboda-ivan-angela",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:0a1b2c3d4e5f..."
};
```

En el mismo archivo, comprueba también:

```javascript
const USE_EMULATORS = false;   // ← debe ser false para producción
```

No toques nada más del archivo (los `import` del SDK desde `gstatic.com` son correctos).

**Comprobación rápida desde la terminal:** este comando no debe mostrar ninguna línea. Si muestra algo, aún queda algún `TU_`:

```bash
grep -n ': "TU_' public/js/firebase-config.js
```

---

### Paso 9 — Comprobar .firebaserc

`.firebaserc` le dice a la CLI a qué proyecto desplegar. **Ya está configurado**:

```json
{
  "projects": {
    "default": "appboda-ivan-angela"
  }
}
```

Solo tendrías que cambiarlo si en el Paso 1 el ID real del proyecto tenía un sufijo.

---

### Paso 10 — Instalar y conectar Firebase CLI

**10.1 — Node.js.** Instala la versión **LTS** desde <https://nodejs.org> (npm viene incluido). Solo se usa para la herramienta `firebase`; la app no lo necesita.

**10.2 — Instalar la CLI:**

```bash
npm install -g firebase-tools
```

> macOS/Linux con error de permisos: `sudo npm install -g firebase-tools`.
> Windows, si PowerShell dice que la ejecución de scripts está deshabilitada: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y vuelve a intentarlo.

```bash
firebase --version      # debe mostrar un número de versión (p. ej. 14.x o 15.x)
```

**10.3 — Iniciar sesión:**

```bash
firebase login
```

Qué ocurre:

1. La terminal pregunta *"Allow Firebase to collect CLI and Emulator Suite usage and error reporting information? (Y/n)"*. Responde lo que prefieras (`n` = no).
2. **Se abre el navegador** con la pantalla de Google: elige la **misma cuenta** con la que creaste el proyecto.
3. Pulsa **"Permitir"** (*Allow*) en los permisos que pide *Firebase CLI*.
4. El navegador muestra **"Woohoo! Firebase CLI Login Successful"** y la terminal: `✔ Success! Logged in as tu-email@...`.

> **Si trabajas en GitHub Codespaces, en un servidor remoto o el navegador no se abre**, usa:
>
> ```bash
> firebase login --no-localhost
> ```
>
> La terminal muestra una URL. Ábrela en tu navegador, inicia sesión, copia el código que aparece y pégalo en la terminal.

**10.4 — Seleccionar el proyecto.** Desde la carpeta raíz del proyecto (donde está `firebase.json`):

```bash
cd ruta/a/AppBoda
firebase use appboda-ivan-angela
```

Respuesta esperada: `Now using project appboda-ivan-angela`.

**10.5 — Comprobar que trabajas sobre el proyecto correcto:**

```bash
firebase use
```

Debe responder `Active Project: appboda-ivan-angela`. Y también:

```bash
firebase projects:list
```

Muestra una tabla donde `appboda-ivan-angela` aparece marcado como **(current)**.

> Si `firebase use appboda-ivan-angela` responde *"Invalid project selection"* o el proyecto no aparece en `projects:list`, has iniciado sesión con otra cuenta de Google. Ejecuta `firebase logout` y repite el 10.3. También puede ser que el ID real tenga sufijo (Paso 1).

---

### Paso 11 — Desplegar las reglas y los índices

**Requisito:** Firestore creado (Paso 6). Ejecuta desde la carpeta del proyecto:

```bash
firebase deploy --only firestore
```

Esto sube **`firestore.rules`** (seguridad) y **`firestore.indexes.json`** (que excluye de los índices la miniatura y la foto, para no gastar espacio de la cuota gratuita). Resultado esperado:

```text
=== Deploying to 'appboda-ivan-angela'...
i  deploying firestore
i  firestore: reading indexes from firestore.indexes.json...
i  cloud.firestore: checking firestore.rules for compilation errors...
✔  cloud.firestore: rules file firestore.rules compiled successfully
i  firestore: deploying indexes...
✔  firestore: deployed indexes in firestore.indexes.json successfully for (default) database
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

> Si solo cambias las reglas más adelante, basta con `firebase deploy --only firestore:rules`.
> **No uses `--only storage`**: este proyecto no tiene Storage y daría error.

**Cómo comprobar que está activo:**

- **Firestore Database → pestaña "Reglas" (Rules):** debe aparecer el texto de `firestore.rules`, incluido el bloque `match /photoFiles/{photoId}`. Arriba se ve la fecha de publicación.
- **Firestore Database → pestaña "Índices" (Indexes) → "Campo único" / "Exenciones" (Single field / Exemptions):** aparecen `photos.thumb` y `photoFiles.data` sin índices. Pueden tardar unos minutos en pasar a "Habilitado".
- Si en la consola ves reglas como `allow read, write: if false;` sin más, o `if request.time < timestamp.date(...)`, **no se han desplegado**: repite este paso.

**Compatibilidad con la autenticación anónima (revisado y probado):** las reglas solo exigen `request.auth != null`, es decir, una sesión (los anónimos la tienen), y comparan `ownerId` con `request.auth.uid`, el UID anónimo. Los permisos de administrador exigen además `sign_in_provider != 'anonymous'` y un documento en `admins`.

---

### Paso 12 — Preparar Firebase Hosting

**No hace falta `firebase init`.** `firebase.json` ya tiene la sección `hosting` correcta (`"public": "public"`, cabeceras de caché y seguridad). Hosting **está incluido en el plan Spark**. Solo hay que asegurarse de que el proyecto tiene su sitio de Hosting por defecto:

```text
PASO 12.1
Firebase Console → menú izquierdo → "Compilación" (Build) → "Hosting".
   ✗ NO "App Hosting" (ese requiere plan de pago).

PASO 12.2
Si ves el botón "Comenzar" (Get started), PÚLSALO.
El asistente muestra tres pantallas con comandos. NO ejecutes esos comandos:
   1. "Instala Firebase CLI"           → PULSA "Siguiente"
   2. "Inicializa tu proyecto"         → PULSA "Siguiente"   (✗ no hagas firebase init)
   3. "Implementa en Firebase Hosting" → PULSA "Continuar a la consola"

PASO 12.3
Ahora la página de Hosting muestra el sitio "appboda-ivan-angela"
con los dominios appboda-ivan-angela.web.app y appboda-ivan-angela.firebaseapp.com.
```

Si en lugar de "Comenzar" ya ves el panel con esos dominios, no tienes que hacer nada.

#### Si a pesar de todo ejecutas `firebase init hosting`

No es necesario y **puede reescribir la sección `hosting` de `firebase.json`**, con lo que se perderían las cabeceras. Si lo haces, responde así:

```text
Pregunta:
Are you ready to proceed? (Y/n)
Respuesta:
Y
Motivo:
Solo inicia el asistente.
```

```text
Pregunta:
Please select an option: (Use an existing project / Create a new project / ...)
Respuesta:
Use an existing project → appboda-ivan-angela
Motivo:
El proyecto ya existe. (Si .firebaserc ya apunta a él, la CLI dice
"Using project appboda-ivan-angela" y no lo pregunta).
```

```text
Pregunta:
What do you want to use as your public directory? (public)
Respuesta:
public
Motivo:
Es la carpeta que contiene index.html, admin.html, js/, css/, manifest.json
y service-worker.js. No hay build, así que se publica tal cual
(NO "dist" ni "build").
```

```text
Pregunta:
Configure as a single-page app (rewrite all urls to /index.html)? (y/N)
Respuesta:
N
Motivo:
La app navega con #anclas (#galeria, #subir...), que nunca llegan al servidor,
así que no necesita reescrituras. Además, /admin.html es un archivo real.
Con "y", cualquier ruta inexistente (p. ej. un .js mal escrito) devolvería
index.html en vez de un 404, y los errores serían muy difíciles de entender.
```

```text
Pregunta:
Set up automatic builds and deploys with GitHub? (y/N)
Respuesta:
N
Motivo:
No hay build y se despliega a mano con "firebase deploy". Con "y" se crea
una cuenta de servicio y se guarda su clave como secreto en GitHub:
complejidad y riesgo innecesarios para esta app.
```

```text
Pregunta:
File public/index.html already exists. Overwrite? (y/N)
Respuesta:
N   ← ¡MUY IMPORTANTE!
Motivo:
Con "y" se sustituye la app por la página de ejemplo de Firebase.
```

```text
Pregunta:
File public/404.html already exists. Overwrite? (y/N)   (o "Wrote public/404.html")
Respuesta:
N (si pregunta)
Motivo:
Si no existía, init crea una página 404 de ejemplo. Es inofensiva:
puedes dejarla o borrarla.
```

Si la CLI pregunta por **web frameworks** (*"Detected an existing … codebase … use a web framework?"*), responde **No**. Si pregunta por **App Hosting**, no lo selecciones: esta app usa **Hosting** clásico.

**Después de `init`, comprueba que `firebase.json` no ha perdido nada:**

```bash
git diff firebase.json
```

Si han desaparecido las `headers` o la sección `firestore`, recupera el original con `git checkout -- firebase.json`.

---

### Paso 13 — Primer deploy

Antes de desplegar:

```text
☐ firebase-config.js sin "TU_" (Paso 8) y USE_EMULATORS = false
☐ firebase use → Active Project: appboda-ivan-angela (Paso 10)
☐ Reglas e índices desplegados (Paso 11)
```

```bash
firebase deploy
```

Esto despliega **todo** lo que define `firebase.json`: reglas e índices de Firestore y la carpeta `public/` en Hosting. No ejecuta ningún build, porque no lo hay. Debería aparecer algo así (el número de archivos puede variar):

```text
=== Deploying to 'appboda-ivan-angela'...

i  deploying firestore, hosting
✔  cloud.firestore: rules file firestore.rules compiled successfully
i  hosting[appboda-ivan-angela]: beginning deploy...
i  hosting[appboda-ivan-angela]: found 23 files in public
✔  hosting[appboda-ivan-angela]: file upload complete
✔  firestore: deployed indexes in firestore.indexes.json successfully for (default) database
✔  firestore: released rules firestore.rules to cloud.firestore
i  hosting[appboda-ivan-angela]: finalizing version...
✔  hosting[appboda-ivan-angela]: version finalized
i  hosting[appboda-ivan-angela]: releasing new version...
✔  hosting[appboda-ivan-angela]: release complete

✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/appboda-ivan-angela/overview
Hosting URL: https://appboda-ivan-angela.web.app
```

La **Hosting URL** que muestre la terminal es la URL real de la app. También funciona `https://appboda-ivan-angela.firebaseapp.com` (el mismo sitio).

> **Importante para despliegues futuros:** cada vez que cambies cualquier archivo de `public/`, sube `CACHE_VERSION` en `public/service-worker.js` (por ejemplo `v1.2.0` → `v1.2.1`) antes de `firebase deploy`. Si no, los móviles que ya tienen la app pueden seguir viendo la versión anterior hasta la siguiente visita. En esta revisión ya la he subido a `v1.2.0`.

---

### Paso 14 — Comprobar la app publicada

Hazlo con **dos navegadores distintos**. Por ejemplo: **A** = tu Chrome normal y **B** = una ventana de incógnito u otro móvil. Así simulas dos invitados.

| # | Qué comprobar | Cómo | Resultado correcto |
|---|---|---|---|
| 1 | **La portada funciona** | Abre `https://appboda-ivan-angela.web.app` | Pantalla con "Iván & Ángela" y campo de código. Sin errores en F12 → *Console*. |
| 2 | **El código de acceso funciona** | Escribe un código erróneo y luego `IvAngela2026` | Erróneo: *"El código introducido no es correcto."* Correcto: entra en la app con la cuenta atrás. |
| 3 | **Se crea el usuario anónimo** | Consola → **Authentication → Usuarios** | Aparece una fila nueva con proveedor **Anónimo** e identificador *(anónimo)*. Cada navegador o dispositivo crea uno. |
| 4 | **Se puede subir una foto** | Navegador A → ➕ Subir → elige 1–2 fotos → **Subir** | Se ve *"6,2 MB → 310 KB"* (o similar), luego *"Subiendo 1 de 2…"* y *"¡Fotos subidas correctamente! ❤️"*. Pasa a la galería. |
| 5 | **La foto está guardada** (en Firestore, no en Storage) | Consola → **Firestore → Datos** → `photoFiles` | Un documento `photo_…` con `ownerId` y `data` (*Bytes*, como máximo 450 KB). |
| 6 | **La información aparece en Firestore** | **Firestore → Datos** → `photos` | Un documento con el **mismo ID**, con `ownerId` (el UID anónimo de A), `likes: 0`, `createdAt`, `width`, `height`, `size` y `thumb` (*Bytes*). |
| 7 | **Se puede dar like** | Navegador B → abre la foto de A → **🤍 Me gusta** | Pasa a *❤️ Te gusta* y el contador sube a 1. En Firestore aparece `photos/{id}/likes/{UID de B}` y `likes: 1`. Si lo pulsas otra vez se quita (`likes: 0`). |
| 8 | **Se puede borrar una foto propia** | Navegador A → abre su foto → **🗑️ Eliminar** → confirmar | *"Foto eliminada"*. Desaparece de la galería y de **las dos** colecciones (`photos` y `photoFiles`). |
| 9 | **Un usuario no puede borrar fotos de otro** | Navegador B → abre una foto de A | **No aparece** el botón 🗑️. El intento forzado desde la consola del navegador se explica en [🔐 Pruebas de seguridad](#-pruebas-de-seguridad-antes-de-la-boda). |
| 10 | **El administrador puede iniciar sesión** | Abre `https://appboda-ivan-angela.web.app/admin.html` (en un tercer navegador/perfil) → email y contraseña del Paso 5 | Panel con estadísticas: nº de fotos, likes, últimas 24 h y espacio. |
| 11 | **El administrador puede borrar fotos** | En el panel → 🗑️ Eliminar sobre una foto de A | *"Fotos eliminadas"*. Desaparece de `photos` y `photoFiles`. |
| 12 | **El ZIP funciona** | En el panel → **📦 DESCARGAR TODAS** | Se descarga `fotos-boda-ivan-angela.zip` con `foto-001.jpg…`. |
| 13 | **⬇️ Descargar en el visor** | Navegador A → abre una foto → ⬇️ | Descarga un `.jpg` o abre el menú *Compartir* en el móvil. |
| 14 | **`/admin.html` funciona al acceder directamente** | Escribe la URL completa en una pestaña nueva | Carga el login (no la app de invitados). Nota: `/admin` sin `.html` da 404, y es lo esperado. |

Después, prueba en móviles reales: [Comprobación desde móvil](#comprobación-desde-móvil).

> **Limpieza tras las pruebas:** borra las fotos de prueba desde `/admin.html`. Los usuarios anónimos de prueba (Authentication → Usuarios) se pueden dejar: no cuestan nada.

---

# 🔐 Pruebas de seguridad antes de la boda

El botón 🗑️ solo aparece en tus propias fotos, pero **ocultar un botón no es seguridad**: alguien con conocimientos puede abrir la consola del navegador y llamar a Firebase directamente. Estas pruebas hacen exactamente eso, para comprobar que **las reglas del servidor** lo impiden. Las reglas ya se probaron automáticamente en el emulador (ver [Verificaciones técnicas realizadas](#verificaciones-técnicas-realizadas)); esto es la confirmación en producción.

**Preparación:**

- **Usuario A** = navegador de escritorio normal (Chrome).
- **Usuario B** = ventana de **incógnito** del mismo Chrome (`Ctrl+Shift+N`). Es otro "dispositivo": otra sesión anónima, otro UID.
- Ambos entran en `https://appboda-ivan-angela.web.app` con el código.
- La consola del navegador se abre con **F12 → pestaña *Console***. Si Chrome avisa de que no pegues código, escribe `allow pasting` y pulsa Enter.

### Usuario A

| Acción | Cómo | Resultado esperado |
|---|---|---|
| Subir foto | ➕ Subir → elegir foto → Subir | ✅ Se sube y aparece con la etiqueta **"Tuya"** |
| Dar like | Abrir su foto → 🤍 Me gusta | ✅ Contador +1. Pulsar de nuevo → −1 |
| Borrar su foto | Abrir su foto → 🗑️ Eliminar | ✅ Desaparece (haz esto **al final**, después de las pruebas de B) |

Antes de borrar, A da like a su foto y apunta dos datos. En la consola de A:

```js
const fb = await import("/js/firebase-config.js");
console.log("Mi UID (A):", fb.auth.currentUser.uid);
```

Y el ID de la foto (`photo_…`), que se ve en **Firestore → Datos → photos**.

### Usuario B (intentos que deben FALLAR)

En la consola de B, carga primero las funciones de la app:

```js
const fb = await import("/js/firebase-config.js");
const ID = "photo_XXXXXXXXXXXXX_xxxxxx";      // ← ID de la foto de A
const UID_A = "XXXXXXXXXXXXXXXXXXXXXXXXXXXX";  // ← UID de A
const yo = fb.auth.currentUser.uid;
const borrar = () => { const b = fb.writeBatch(fb.db); b.delete(fb.doc(fb.db, "photos", ID)); b.delete(fb.doc(fb.db, "photoFiles", ID)); return b.commit(); };
```

Ejecuta cada intento **por separado**. Todos deben responder `FirebaseError: Missing or insufficient permissions.`:

| Intento de B | Código en la consola de B |
|---|---|
| **Borrar la foto de A** | `await borrar()` |
| **Borrar solo el archivo de la foto de A** | `await fb.deleteDoc(fb.doc(fb.db, "photoFiles", ID))` |
| **Sustituir la foto de A por otra imagen** | `await fb.setDoc(fb.doc(fb.db, "photoFiles", ID), {ownerId: yo, data: fb.Bytes.fromUint8Array(new Uint8Array(10))})` |
| **Modificar la información de A (apropiarse de la foto)** | `await fb.setDoc(fb.doc(fb.db, "photos", ID), {ownerId: yo}, {merge: true})` |
| **Inflar los likes (+10)** | `await fb.setDoc(fb.doc(fb.db, "photos", ID), {likes: fb.increment(10)}, {merge: true})` |
| **Quitar el like de A** | `await fb.deleteDoc(fb.doc(fb.db, "photos", ID, "likes", UID_A))` |
| **Hacerse administrador** | `await fb.setDoc(fb.doc(fb.db, "admins", yo), {email: "x"})` |
| **Usar el borrado de administrador** | `const p = await import("/js/photos.js"); await p.deletePhoto({id: ID}, {purgeLikes: true})` |
| **Inyectar código en la galería** | `await fb.setDoc(fb.doc(fb.db, "photos", "photo_1_abc"), {ownerId: yo, createdAt: fb.serverTimestamp(), likes: 0, width: 1, height: 1, size: 1, thumb: "x\" onerror=\"alert(1)"})` |

Y además:

| Intento de B | Resultado esperado |
|---|---|
| **Acceder al panel de administración**: abrir `https://appboda-ivan-angela.web.app/admin.html` en la ventana de B | Solo ve el formulario de login. Sin email y contraseña de un admin no pasa de ahí. |

Después, A (y no B) borra su foto: ✅ debe funcionar.

> **Si alguno de los intentos de B funciona** (no da error), **no uses la app** hasta revisarlo. Lo más probable es que las reglas no estén desplegadas: repite el [Paso 11](#paso-11--desplegar-las-reglas-y-los-índices) y comprueba en *Firestore → Reglas* que el texto coincide con `firestore.rules`.

### El código `IvAngela2026` está en el JavaScript público: ¿es un problema?

**Es una barrera de interfaz, NO una contraseña de seguridad.** El código está en `public/js/wedding-config.js`, que se descarga en cualquier navegador que abra la URL. Cualquiera con conocimientos técnicos puede leerlo, e incluso saltarse la pantalla del código e iniciar una sesión anónima directamente contra Firebase.

Lo que **sí** impide (las reglas, no el código):

- Borrar, modificar o sustituir fotos de otros invitados.
- Manipular likes ajenos o inflar contadores.
- Hacerse administrador.
- Leer nada sin una sesión de Firebase.
- Inyectar código en la galería: las imágenes se guardan como bytes, nunca como URLs o texto, y la app escapa todo lo que pinta.

Lo que **no** impide (y conviene asumir):

| Riesgo | Gravedad para una boda | Mitigación |
|---|---|---|
| Alguien que conozca la URL puede **ver la galería** y **subir fotos** sin saber el código | Baja: la URL solo circula entre invitados | No publiques la URL ni el QR en redes sociales. El cartel con QR + código solo en la boda. |
| Abuso: subir muchas fotos con un script para **agotar la cuota gratuita** | Baja (no cuesta dinero: en Spark no se puede cobrar) | Las reglas limitan cada foto a 900 KB y cada miniatura a 80 KB. El admin puede borrar. Si ocurriera, la app dejaría de subir fotos hasta que se renueve la cuota. |

Cambiar el código por otro **no mejora la seguridad**, porque seguiría siendo público. Si se filtra fuera de la boda, cámbialo en `wedding-config.js`, sube `CACHE_VERSION` y despliega: los dispositivos ya autorizados seguirán dentro, pero los nuevos necesitarán el código nuevo.

**Secretos:** el proyecto **no contiene ningún secreto privado**. `apiKey` y el resto de `firebaseConfig` son identificadores públicos. La contraseña del admin solo existe en Firebase Authentication. `.gitignore` excluye `.env` y las claves de cuentas de servicio (`*-firebase-adminsdk-*.json`). **No subas nunca** a Git una clave de cuenta de servicio.

---

# 💰 Costes y límites

## Coste: 0 €, garantizado

La app usa **solo servicios incluidos en el plan Spark**: Hosting, Firestore y Authentication (anónimo + email). **No usa Cloud Storage**, que desde 2024–2026 exige el plan de pago Blaze. Las fotos se guardan dentro de Firestore.

En Spark **no hay tarjeta asociada**, así que es imposible que Google cobre nada. Mientras no pulses nunca "Actualizar a Blaze", el coste es **0 €** pase lo que pase.

> ⚠️ Las cuotas de Firebase pueden cambiar. Las de esta sección se comprobaron en la página oficial <https://firebase.google.com/pricing> y en la documentación de cuotas de Firestore en **octubre de 2026**. Vuelve a comprobarlas antes de la boda.

## Límites gratuitos que afectan a la app

| Servicio | Límite Spark | Cuándo se renueva | Qué lo consume en esta app |
|---|---|---|---|
| **Firestore — almacenamiento** | **1 GiB** | No se renueva (es el total guardado) | Cada foto ≈ 300–480 KB (foto + miniatura) |
| **Firestore — lecturas** | **50.000/día** | Cada día a las **09:00** hora de España (medianoche del Pacífico) | Ver la galería, abrir fotos, comprobar likes |
| **Firestore — escrituras** | **20.000/día** | Ídem | 2 por foto subida, 2 por like |
| **Firestore — eliminaciones** | **20.000/día** | Ídem | 2 por foto borrada |
| **Firestore — transferencia de salida** | **10 GiB/mes** | Cada mes | Miniaturas vistas, fotos abiertas, ZIP del admin |
| **Hosting — transferencia** | **360 MB/día** | Cada día | La web (~300 KB por dispositivo la primera vez) |
| **Hosting — almacenamiento** | 10 GB | — | La web ocupa ~300 KB |
| **Authentication** | 50.000 usuarios activos/mes | Cada mes | Un usuario anónimo por navegador/dispositivo |

## Estimación para esta boda (~100 invitados, ~50 usando la app)

Estos números **son estimaciones**: dependen de cuántas fotos se suban y de cuánto miren la galería los invitados. Supuestos:

- Foto guardada ≈ **300 KB** (máx. 450 KB; las fotos de móvil reales suelen quedar en 200–400 KB) + miniatura ≈ **25 KB**.
- Cada uno de los 50 usuarios sube ~20 fotos → **~1.000 fotos**. También se calcula un escenario alto de 2.000.
- Cada usuario, el día de la boda, ve ~300 miniaturas, abre ~40 fotos y da ~30 likes.

| Recurso | 1.000 fotos | 2.000 fotos | Límite gratuito | ¿Cabe? |
|---|---|---|---|---|
| Almacenamiento Firestore | ≈ 0,33 GB | ≈ 0,65 GB | 1 GiB | ✅ (caben **~3.000 fotos**) |
| Escrituras el día de la boda (fotos + likes) | ≈ 2.000 + 3.000 = 5.000 | ≈ 4.000 + 3.000 = 7.000 | 20.000/día | ✅ |
| Lecturas el día de la boda | ≈ 20.000 – 30.000 | ≈ 25.000 – 40.000 | 50.000/día | ✅ con margen razonable |
| Transferencia en el mes de la boda | ≈ 1,5 GB (+0,3 GB por cada ZIP completo) | ≈ 2 GB (+0,6 GB por ZIP) | 10 GiB/mes | ✅ |
| Hosting | ≈ 15–30 MB/día | ídem | 360 MB/día | ✅ |

**Cómo se calcula el consumo de lecturas** (la cuota más ajustada):

- Abrir la galería = 24 lecturas (un bloque). Al hacer scroll, +24 por bloque, **sin volver a leer** las que ya estaban cargadas.
- Volver a abrir la app: la caché del dispositivo hace que solo se cobren los cambios si han pasado menos de 30 minutos.
- Abrir una foto = 2 lecturas (la foto + comprobar si ya le diste like).
- Cada foto nueva que llega en tiempo real = 1 lectura por cada invitado que tenga la galería abierta en ese momento.
- Las reglas de seguridad también hacen alguna lectura interna al subir o dar like.

### Qué pasa si se supera un límite

**Nunca se cobra nada.** El recurso agotado deja de funcionar temporalmente:

| Límite agotado | Síntoma | Se arregla solo |
|---|---|---|
| Lecturas (50.000/día) | La galería no carga. Mensaje *"Se ha alcanzado el límite gratuito de hoy"* | Al día siguiente a las **09:00** (hora de España) |
| Escrituras (20.000/día) | No se pueden subir fotos ni dar likes | Ídem |
| Almacenamiento (1 GiB) | No se pueden subir más fotos | No: hay que borrar fotos (o descargarlas y borrarlas) |
| Transferencia (10 GiB/mes) | La galería no carga | El mes siguiente |

### Consejos para no acercarse a los límites

1. **No subas** `upload.maxBytes` ni `maxSide` en `wedding-config.js`: es lo que hace que quepan ~3.000 fotos.
2. **Haz el ZIP completo el día después de la boda (después de las 09:00) y no el mismo día**: cada ZIP lee todas las fotos (1 lectura y ~300 KB de transferencia por foto).
3. Vigila el consumo la víspera y el día después en **Firestore Database → pestaña "Uso"** (*Usage*): lecturas, escrituras y almacenamiento.
4. Si un día se agotaran las lecturas, las fotos **no se pierden**: siguen guardadas y vuelven a verse al renovarse la cuota.

> **Calidad de las fotos:** para que quepan en el plan gratuito, la app guarda cada foto a **1600 px** de lado mayor y como máximo 450 KB. Es calidad de sobra para verlas en móvil, tablet u ordenador, y para imprimirlas hasta ~13×18 cm. **No guarda el original.** Si queréis una foto concreta a máxima calidad, pedidle el original al invitado.

---

# 💾 Backup antes y después de la boda

**Cuándo:**

1. **Antes de la boda:** copia del **código y la configuración** (para poder volver a desplegar si algo falla).
2. **El día después de la boda (después de las 09:00):** primera copia de las **fotos**.
3. **1–2 semanas después** (cuando ya nadie sube fotos): copia **definitiva** de fotos + datos.

### 1. Código

El código ya está en Git. Súbelo a un repositorio **privado** en GitHub (o similar):

```bash
git add -A
git commit -m "Configuración Firebase appboda-ivan-angela (plan Spark)"
git push
```

Además, guarda un ZIP de la carpeta del proyecto en otro sitio (disco externo o nube personal). `firebase-config.js` puede ir en el repositorio: no contiene secretos.

### 2. Configuración de Firebase

Lo que está en archivos (y por tanto en Git): `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json` y `public/js/firebase-config.js`.

Lo que **solo está en la consola** y conviene apuntar (por ejemplo, en una nota junto al backup):

```text
Proyecto:               appboda-ivan-angela
Plan:                   Spark (sin tarjeta)
Firestore:              (default), europe-southwest1, edición Standard
Authentication:         Anónimo ✔, Correo/contraseña ✔
Administradores (UID):  ...  (email ...)
Hosting:                https://appboda-ivan-angela.web.app
```

### 3. Las fotos, lo más importante

**Panel de administrador → 📦 DESCARGAR TODAS:**

1. Abre `https://appboda-ivan-angela.web.app/admin.html` **en un ordenador** (Chrome, Edge o Firefox) y entra.
2. Pulsa **📦 DESCARGAR TODAS** y espera sin cerrar la pestaña (*"Descargando N de M…"* → *"Generando ZIP…"*).
3. Se descarga `fotos-boda-ivan-angela.zip` (`foto-001.jpg` es la más antigua). Con más de 300 fotos (`admin.zipMaxPhotosPerFile`) se generan varias partes: `-parte-1.zip`, `-parte-2.zip`…
4. Para descargar solo algunas: marca las casillas → **📦 Descargar seleccionadas**.

> En el plan Spark no está disponible la exportación oficial de Firestore (`gcloud firestore export`), que requiere facturación. **El ZIP del panel es la copia de las fotos**: hazlo dos veces (día siguiente y definitiva) y guárdalo en varios sitios.

### 4. Datos (likes, fechas y autores de cada foto), opcional

Entra en `/admin.html` como administrador, abre F12 → *Console* y pega:

```js
const fb = await import("/js/firebase-config.js");
const { saveBlob } = await import("/js/utils.js");
const snap = await fb.getDocs(fb.collection(fb.db, "photos"));
const data = snap.docs.map(d => { const { thumb, createdAt, ...rest } = d.data(); return { id: d.id, ...rest, createdAt: createdAt?.toDate().toISOString() }; });
saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "firestore-photos.json");
```

Se descarga `firestore-photos.json` con cada foto: fecha, likes, autor anónimo y tamaño. El `id` coincide con el de los archivos del ZIP. Consume 1 lectura por foto.

### Conservar las fotos durante años

Regla **3-2-1**: **3** copias, en **2** soportes distintos, y **1** fuera de casa.

1. **Disco duro externo** con la carpeta descomprimida + `firestore-photos.json`.
2. **Nube personal** (Google Fotos, Google Drive, iCloud, OneDrive…). Subirlas a un **álbum compartido** de Google Fotos o iCloud es además la forma más cómoda de compartirlas con la familia cuando la app ya no exista.
3. Un **segundo disco** o pendrive guardado en otra casa (padres, hermanos).
4. Revisa las copias **una vez al año** (que abran) y cambia de disco cada pocos años.

**¿Y la app después?**

| Opción | Coste | Qué hacer |
|---|---|---|
| Dejarla como recuerdo | 0 € (Spark) | Nada. Opcional: cambiar el código de acceso. |
| Cerrarla pero conservar los datos | 0 € | Despliega una página de "Gracias" en lugar de la app, o desactiva Hosting. |
| Borrarlo todo | 0 € | **Solo tras comprobar las copias.** ⚙️ → Configuración del proyecto → *Eliminar proyecto*. Es irreversible tras 30 días. |

> **No confíes en Firebase como archivo a largo plazo.** Es un servicio gratuito sin compromiso de conservación. Las copias locales son las que garantizan conservar las fotos durante años.

---

# 📱 Código QR

El QR debe apuntar **exactamente** a:

```text
https://appboda-ivan-angela.web.app
```

(Usa la *Hosting URL* que muestre `firebase deploy` si fuese distinta. Sin `/index.html` ni `/admin.html` al final).

### Cómo generarlo

- **Chrome (ordenador o Android):** abre la URL → menú **⋮** (o el icono de compartir de la barra de direcciones) → **Compartir** → **Crear código QR** → **Descargar**.
- **Cualquier generador gratuito de QR estático.** Evita los QR **"dinámicos"**: redirigen a través de su servidor y pueden caducar, mostrar publicidad o pasar a ser de pago.
- Opciones al generarlo: **nivel de corrección de errores M o Q** (aguanta manchas o arrugas), **PNG de alta resolución o SVG**, negro sobre fondo blanco (o muy oscuro sobre muy claro). No metas la URL en un acortador.

### Texto que acompaña al QR

El cartel **debe incluir el código**, porque la app no lo muestra:

```text
📸 ¡Comparte tus fotos con nosotros!
1. Escanea el código con la cámara del móvil
2. Introduce el código: IvAngela2026
3. Sube tus fotos ❤️
```

### Dónde ponerlo

- **En las mesas** del banquete: un QR por mesa, de **5 × 5 cm** como mínimo.
- **En carteles**: tamaño A4/A3, con QR de **10–15 cm**.
- **En la entrada** de la finca y del salón.
- **Junto al photocall**: es donde más fotos se hacen.
- **En la papelería de la boda**: minutas, seating plan, tarjetas de mesa o una tarjeta en la invitación (mínimo **3 × 3 cm**).
- También junto al libro de firmas o en la barra.

**Antes de imprimir todo, prueba el QR impreso** con un iPhone y un Android, con la luz real del salón si es posible.

---

# 🖼️ Imagen de portada (heroImage)

La portada (pantalla del código y pestaña **Inicio**) puede llevar una foto de fondo. Ahora mismo `heroImage` está vacío y se usa el fondo crema liso.

### Cómo añadirla

```text
PASO 1
Prepara la imagen (ver recomendaciones abajo) y llámala, por ejemplo:
   portada.jpg

PASO 2
Cópiala a:
   public/assets/images/portada.jpg

PASO 3
En public/js/wedding-config.js cambia:
   heroImage: "",
por:
   heroImage: "assets/images/portada.jpg",
   (ruta relativa, SIN "/" al principio)

PASO 4
En public/service-worker.js sube CACHE_VERSION (p. ej. "v1.1.0" → "v1.1.1").

PASO 5
firebase deploy --only hosting
```

### Formato y tamaño recomendados

| Parámetro | Recomendación | Motivo |
|---|---|---|
| Formato | **JPEG** (o WebP) | Universal y pequeño. **No** uses PNG para fotos (pesa 5–10 veces más) ni HEIC (no se ve en Android ni en Chrome). |
| Orientación | **Vertical** | Se muestra a pantalla completa en el móvil con `background-size: cover`. |
| Dimensiones | **1080 × 1920 px** (máximo 1200 px de ancho) | Suficiente para móviles con pantalla de alta densidad. Más resolución solo añade peso. |
| Peso | **< 250 KB** (ideal 150 KB) | Es lo primero que carga, a veces con la mala cobertura de la finca. |
| Calidad JPEG | 65–75 % | La portada lleva encima una capa crema al 82–92 %, así que no se notan los artefactos. |
| Composición | Motivo principal en el **centro** | `cover` recorta los lados o arriba y abajo según la pantalla. |

Herramienta gratuita para redimensionar y comprimir sin instalar nada: <https://squoosh.app> (elige *MozJPEG*, calidad ~70, *Resize* a 1080 de ancho).

**Notas:**

- La imagen se ve **muy suavizada** a propósito, para que el texto se lea bien. Si quieres que se vea más, en `public/css/styles.css` (regla `.hero--image`) baja los valores `.82` y `.92` de `rgba(250, 247, 242, …)`, por ejemplo a `.6` y `.75`.
- La portada es visible **antes** de introducir el código: no pongas nada que no quieras que vea quien tenga la URL.
- Si más adelante cambias la imagen, usa **otro nombre de archivo** (`portada-2.jpg`): `firebase.json` hace que los móviles guarden `assets/` en caché durante 7 días.

---

# 📚 Referencia

## Reglas de seguridad: qué permite cada una

Las reglas completas están en **`firestore.rules`** (comentadas en español). Se despliegan con `firebase deploy --only firestore` ([Paso 11](#paso-11--desplegar-las-reglas-y-los-índices)). No las copies a mano en la consola: así el archivo del proyecto y lo publicado siempre coinciden.

| Acción | Quién | Cómo se garantiza |
|---|---|---|
| **Leer fotos** (`photos` y `photoFiles`) | Cualquier dispositivo con sesión (invitado anónimo o admin) | `signedIn()`. Sin sesión de Firebase no se puede leer nada. |
| **Crear foto** | Cualquier invitado, **solo a su nombre** | Se crean `photos/{id}` y `photoFiles/{id}` **en el mismo lote** (`getAfter`) y con el mismo `ownerId == request.auth.uid`. Además: `likes == 0`; `createdAt == request.time` (hora del servidor, no falsificable); solo los campos permitidos; `width`/`height`/`size` enteros; `thumb` y `data` de tipo **bytes** (nunca texto ni URLs), con un máximo de 80 KB y 900 KB. |
| **Sustituir una foto** | Nadie | `photoFiles`: `allow update: if false`. Al crear se exige que no exista ya `photos/{id}`. |
| **Likes** | Cualquier invitado, **uno por foto** | El like es el documento `likes/{uid}` con el propio UID, así que no puede existir dos veces. El contador `likes` solo puede cambiar **±1**, y **solo si en la misma operación atómica** se crea (o borra) el like del propio UID (`exists` / `existsAfter`). |
| **Modificar foto** | Nadie (salvo el contador de likes, como arriba) | `affectedKeys().hasOnly(['likes'])`: no se puede cambiar `ownerId`, la miniatura ni nada más. |
| **Eliminar foto** | El dueño (`ownerId == request.auth.uid`) o el admin | Siempre `photos` y `photoFiles` juntos (`!existsAfter`), así nunca quedan datos huérfanos. Un invitado no puede borrar fotos de otro porque su UID no coincide. |
| **Administración** | Usuarios con documento en `admins/{uid}` que **no** sean anónimos | `isAdmin()`. La colección `admins` no se puede escribir desde la app (`allow write: if false`), solo desde la consola. |
| **Todo lo demás** | Nadie | Regla final `/{document=**}` denegada. |

---

## Código de acceso

En **`public/js/wedding-config.js`**:

```javascript
accessCode: "IvAngela2026",
```

- Se compara **sin distinguir mayúsculas/minúsculas** y quitando espacios (más cómodo para invitados con el móvil: `ivangela2026` también vale).
- Una vez introducido, el dispositivo queda autorizado (`localStorage`). El código **no vuelve a mostrarse** en la interfaz.
- En **ℹ️ Más → Cerrar sesión** se vuelve a pedir el código (las fotos del invitado no se borran y sigue pudiendo eliminarlas si vuelve a entrar desde el mismo navegador).

> ⚠️ **Es una barrera de la interfaz, no una medida de seguridad.** El código está en el JavaScript descargado y cualquiera con conocimientos puede leerlo. Lo que protege las fotos son las **reglas de Firestore** ([Reglas de seguridad](#reglas-de-seguridad-qué-permite-cada-una)).

---

## Configuración de la boda

Todo está centralizado en **`public/js/wedding-config.js`**:

| Qué | Campo |
|---|---|
| Nombres de los novios | `coupleNames: "Iván & Ángela"` |
| Iniciales de la cabecera | `monogram: "I & Á"` |
| Fecha | `date: "2026-11-07"` (formato AAAA-MM-DD) |
| Hora objetivo de la cuenta atrás | `countdownTime: "13:00"` (vacío = medianoche) |
| Código | `accessCode` |
| Ceremonia | `ceremony: { name, address, time, mapsUrl }` |
| Banquete | `reception: { name, address, time, mapsUrl }` |
| Programa del día | `schedule: [{ time: "12:30", title: "Ceremonia", description: "" }, ...]` |
| Información adicional | `extraInfo: [{ title: "Dress code", text: "..." }, ...]` |
| Textos | `texts: { gateTagline, welcome, countdownBefore, countdownToday, countdownAfter, uploadIntro, galleryEmpty }` |
| Colores | `theme: { cream, ink, gold, beige }` |
| Imagen de portada | `heroImage: "assets/images/portada.jpg"` |
| Límites de subida | `upload: { maxFilesPerUpload: 20, maxOriginalSizeMB: 40, maxSide: 1600, quality: 0.75, maxBytes: 450 KB, ... }` (no los subas: ver [💰](#-costes-y-límites)) |
| Fotos por bloque en la galería | `gallery.pageSize` |
| Nombre y partes del ZIP | `admin: { zipBaseName, zipMaxPhotosPerFile }` |

Los campos vacíos se muestran como **"Por confirmar"** y el botón **📍 Cómo llegar** aparece desactivado.

**📍 Cómo llegar:**
- Si rellenas `mapsUrl`, se usa ese enlace. Para obtenerlo: abre Google Maps → busca el lugar → **Compartir** → **Copiar enlace**.
- Si solo rellenas `address`, se genera automáticamente un enlace de búsqueda de Google Maps.

**Otros elementos (fuera del archivo de configuración):**

- **Nombre de la app instalada y colores de la barra del sistema:** `public/manifest.json` (`name`, `short_name`, `theme_color`, `background_color`) y las etiquetas `<meta name="theme-color">` / `<title>` de `index.html` y `admin.html`.
- **Iconos:** reemplaza los PNG de `public/assets/icons/` manteniendo nombres y tamaños exactos: `icon-192.png` (192×192), `icon-512.png` (512×512), `icon-maskable-512.png` (512×512 con el motivo dentro del 80 % central), `apple-touch-icon.png` (180×180, sin transparencia), `favicon-32.png` (32×32) e `icon.svg`.
- **Imagen de portada:** ver [🖼️ Imagen de portada](#️-imagen-de-portada-heroimage).
- **Tipografías:** `--font-display` y `--font-body` al principio de `public/css/styles.css` + el `<link>` de Google Fonts en los HTML.

> Tras cambiar cualquier archivo, incrementa `CACHE_VERSION` en `public/service-worker.js` (p. ej. `v1.1.0` → `v1.1.1`) antes de desplegar, para que los móviles que ya tengan la app instalada reciban la versión nueva.

**Reutilizar para otra boda:** crea otro proyecto de Firebase, cambia `firebase-config.js`, `wedding-config.js` (incluido `weddingId`), `manifest.json` e iconos.

---

## Probar en local

El proyecto **no tiene dependencias** (`npm install` no es necesario). Todo se sirve con la CLI de Firebase.

> ⚠️ Hay que abrirla **a través de un servidor** (`http://localhost:...`), no haciendo doble clic en `index.html` (`file://`): los módulos JavaScript y el service worker no funcionan así.

### Opción 1 (recomendada): local contra tu Firebase real

Requiere haber completado los pasos 1–14 de la [guía](#-configuración-de-firebase-paso-a-paso) (`firebase login` + `firebase use` + reglas desplegadas).

```bash
cd ruta/al/proyecto/AppBoda
firebase deploy --only firestore           # sube reglas e índices (si aún no lo hiciste)
firebase emulators:start --only hosting    # sirve public/ en http://localhost:5000
```

Abre **<http://localhost:5000>** (y **<http://localhost:5000/admin.html>**). Para parar: `Ctrl + C`.

Las fotos que subas en local van a tu Firebase real; bórralas después desde el panel de administración.

### Opción 2: todo con emuladores (sin tocar Firebase real)

1. En `public/js/firebase-config.js` pon `const USE_EMULATORS = true;` (y **vuelve a ponerlo en `false` antes de desplegar**).
2. Los emuladores necesitan **Java 11+** (<https://adoptium.net>).
3. Ejecuta:

   ```bash
   firebase emulators:start
   ```

4. App: **<http://localhost:5000>** · Interfaz de emuladores: **<http://localhost:4000>**.
5. Para probar el admin: en <http://localhost:4000> → **Authentication** → *Add user* (email/contraseña) → copia su UID → **Firestore** → *Start collection* `admins` → documento con ese UID → campo `email`.
6. Los datos de los emuladores se borran al pararlos.

### Qué comprobar

- [ ] **Acceso:** un código incorrecto muestra *"El código introducido no es correcto."*; el correcto entra. Al recargar ya no lo pide.
- [ ] **Subida:** ➕ Subir → *Elegir fotos* → selecciona varias. Se ven miniaturas y *"6,2 MB → 780 KB"*.
- [ ] **Compresión:** en Firestore (consola) el campo `size` de cada foto es ≤ 460.800 (450 KB).
- [ ] **Progreso:** *"Subiendo 3 de 8..."* y al final *"¡Fotos subidas correctamente! ❤️"*.
- [ ] **Galería:** las fotos aparecen al instante, también en otra pestaña/dispositivo sin recargar.
- [ ] **Likes:** ❤️ Me gusta suma 1; volver a pulsar lo quita; nunca suma 2 desde el mismo navegador.
- [ ] **Descarga:** ⬇️ Descargar guarda un `.jpg`.
- [ ] **Eliminar propias:** en tus fotos aparece 🗑️ Eliminar con confirmación; en las de otros (abre otra ventana de incógnito) no aparece.
- [ ] **Admin:** `/admin.html` → login → estadísticas correctas → eliminar una foto de otro invitado.
- [ ] **ZIP:** 📦 DESCARGAR TODAS → `fotos-boda-ivan-angela.zip` con `fotos-boda-ivan-angela/foto-001.jpg…`.
- [ ] **PWA:** Chrome escritorio muestra el icono de instalar en la barra de direcciones. DevTools (F12) → *Application* → *Manifest* sin errores y *Service Workers* "activated".
- [ ] **Responsive:** DevTools → icono de móvil (Ctrl+Shift+M) → iPhone SE, iPhone 14 Pro, iPad, escritorio.
- [ ] **iPhone / Android:** ver [Comprobación desde móvil](#comprobación-desde-móvil) (se prueba mejor ya desplegado, porque requiere HTTPS).

---

## Comprobación desde móvil

Hazlo con la app **desplegada** (o un canal de vista previa): la cámara, la instalación PWA y el service worker requieren HTTPS.

### Android (Chrome)

- [ ] Escanea el QR con la cámara → se abre Chrome → introduce el código.
- [ ] ➕ Subir → *Elegir fotos* → permite elegir de la galería o hacer una foto con la cámara.
- [ ] Selecciona **varias** fotos → se comprimen (ves *"X MB → Y KB"*) → **Subir** → *"Subiendo 1 de N..."*.
- [ ] 📸 Galería: 2 columnas, las fotos aparecen al momento.
- [ ] Visor: deslizar ← → cambia de foto, deslizar hacia abajo o el botón **atrás** del sistema lo cierra.
- [ ] ⬇️ Descargar: abre el menú *Compartir* (elige *Guardar* / Fotos / Drive) o descarga el archivo.
- [ ] Instala la app (ver [PWA](#pwa)) y ábrela desde el icono.
- [ ] La barra inferior no queda tapada por la barra de gestos.

### iPhone (Safari)

- [ ] Escanea el QR con la **cámara** → abre en **Safari** → código.
- [ ] Subir fotos: aparece *Fototeca / Hacer foto / Seleccionar archivo*. Las fotos HEIC se convierten automáticamente a JPEG.
- [ ] Las fotos verticales salen **derechas** (orientación corregida).
- [ ] ⬇️ Descargar → se abre la hoja de compartir → **Guardar imagen** (va al carrete). Si en su lugar aparece *"¿Descargar?"*, se guarda en la app *Archivos*.
- [ ] Añade a pantalla de inicio (ver [PWA](#pwa)) → abre desde el icono → la cabecera no queda bajo la *Dynamic Island*/*notch* y la barra inferior no queda bajo la barra de inicio.
- [ ] Gira el móvil en horizontal: nada queda debajo de las esquinas redondeadas.

---

## PWA

### Comprobar la configuración

En Chrome de escritorio: abre la URL → **F12** → pestaña **Application**:
- **Manifest:** nombre "Iván & Ángela", iconos visibles, sin errores.
- **Service workers:** `service-worker.js` con estado *activated and is running*.
- Opcional: pestaña **Lighthouse** → categoría *Progressive Web App* / *Best practices*.

### Android

Chrome → menú **⋮** → **"Instalar aplicación"** o **"Añadir a pantalla de inicio"**. (Chrome a veces muestra también un aviso automático, o el botón **Instalar ahora** en la sección **ℹ️ Más** de la app).

### iPhone / iPad

Safari → botón **Compartir** (cuadrado con flecha hacia arriba) → **"Añadir a pantalla de inicio"** → **Añadir**. (La sección **ℹ️ Más** de la app muestra estas instrucciones).

### Limitaciones de iOS

- Solo se puede instalar desde **Safari** (en iOS 16.4+ también desde Chrome/Edge mediante *Compartir → Añadir a pantalla de inicio*).
- iOS **no muestra un botón automático de instalar**: hay que hacerlo manualmente (por eso las instrucciones en la app).
- **La app instalada y Safari tienen almacenamiento separado**: al abrir la app instalada por primera vez hay que volver a introducir el código, y cuenta como **otro dispositivo** (las fotos subidas desde Safari solo se pueden borrar desde Safari, y viceversa; el admin puede borrar cualquiera).
- Si el iPhone está en **navegación privada**, al cerrarla se pierde la identidad (no podrá borrar sus fotos después).
- iOS puede borrar los datos de webs que no se usan en semanas; no afecta a las fotos (están en Firebase).

---

## Comandos de despliegue habituales

Todos se ejecutan desde la carpeta raíz del proyecto, con `firebase use` apuntando a `appboda-ivan-angela`.

| Comando | Qué hace | Cuándo usarlo |
|---|---|---|
| `firebase deploy` | Todo: Hosting + reglas e índices de Firestore | Primer despliegue o si dudas |
| `firebase deploy --only hosting` | Publica la carpeta `public/` (HTML, CSS, JS, iconos) | Cambias textos, diseño, `wedding-config.js` o la portada (**sube antes `CACHE_VERSION`**) |
| `firebase deploy --only firestore` | Reglas + `firestore.indexes.json` | Cambias `firestore.rules` o los índices |
| `firebase deploy --only firestore:rules` | Solo las reglas de Firestore | Cambias `firestore.rules` |
| `firebase hosting:channel:deploy prueba` | URL temporal de vista previa (7 días, HTTPS) **sin tocar la web pública** | Probar cambios desde el móvil antes de publicarlos |

> Los canales de vista previa usan la misma base de datos que producción.
> `firebase deploy --only storage` **no se usa**: el proyecto no tiene Storage.

**Volver a una versión anterior de la web:** Firebase Console → **Hosting** → *Historial de versiones* (*Release history*) → ⋮ en la versión buena → **Restaurar** (*Rollback*).

**Dominio propio (opcional):** Hosting → **Agregar dominio personalizado** y sigue los pasos DNS. Después añádelo en *Authentication → Configuración → Dominios autorizados*. Hosting admite dominios propios en Spark.

---

## Verificaciones técnicas realizadas

Antes de escribir esta guía revisé todo el proyecto (`firebase.json`, `.firebaserc`, reglas, todos los módulos JS, el service worker y el manifest) y lo probé en los **emuladores de Firebase**:

- **41 pruebas de reglas** (Firestore + Auth): subida legítima, límites de tamaño, lotes incompletos, suplantación de dueño, inyección de texto, likes, borrados, un segundo usuario, un usuario con email que no es admin y el admin.
- **25 pruebas de extremo a extremo en un navegador real** (Chromium) con la app tal cual:
  - Acceso con código y subida de 26 fotos.
  - Un original de **12 MB** guardado en **394 KB**.
  - Paginación con scroll y foto nueva recibida en tiempo real por otro usuario.
  - Visor con foto completa, likes y descarga.
  - Borrado propio, panel de admin (estadísticas, borrado) y ZIP con 25 JPEG válidos.

### Cambios realizados

| # | Cambio | Motivo |
|---|---|---|
| 1 | **Plan Spark: las fotos se guardan en Firestore** (`photos` con miniatura + `photoFiles` con la foto) en lugar de Cloud Storage. Afecta a `photos.js`, `gallery.js`, `admin.js`, `upload.js`, `firebase-config.js`, `firestore.rules`, `firestore.indexes.json` y `firebase.json` (sin sección `storage`). | Cloud Storage exige el plan de pago Blaze. Con Spark el coste es 0 € garantizado. |
| 2 | **Compresión con tope de tamaño** (`upload.maxBytes` = 450 KB, 1600 px; miniatura de 360 px y máx. 60 KB): baja calidad y, si hace falta, resolución hasta cumplirlo. | Un documento de Firestore admite como máximo 1 MiB y la cuota gratuita es de 1 GiB (~3.000 fotos). |
| 3 | **Paginación con cursor** (`startAfter`) y tiempo real solo en el bloque más reciente. | Antes cada "cargar más" volvía a leer todas las fotos ya cargadas: con la cuota de 50.000 lecturas/día de Spark era el mayor riesgo. |
| 4 | **Caché persistente de Firestore** en el dispositivo (IndexedDB). | Al volver a abrir la app solo se cobran los cambios. |
| 5 | **XSS persistente corregido.** La galería insertaba datos de Firestore en el HTML sin escapar. Ahora se escapan, y las reglas solo admiten bytes en las imágenes y enteros en las dimensiones. | Un invitado podía ejecutar JavaScript en el móvil de todos. |
| 6 | **Nadie puede sustituir la foto de otro** (`photoFiles`: sin `update`, y al crear no puede existir ya la foto). | En la versión con Storage era posible sobrescribir el archivo de otro invitado (lo detectaron las pruebas). |
| 7 | `.firebaserc` → `appboda-ivan-angela`. `firebase-config.js` con `projectId` y `authDomain`. `CACHE_VERSION` → `v1.2.0`. | Configuración del proyecto real. |

> `storage.rules` y `cors.json` siguen en el repositorio pero **ya no se usan** (nada los referencia). Se pueden borrar.

### Comprobaciones

| Comprobación | Resultado |
|---|---|
| `projectId` = `appboda-ivan-angela` | ✅ En `firebase-config.js` y `.firebaserc` (verifica el ID real en el [Paso 1](#paso-1--abrir-el-proyecto-comprobar-su-id-y-el-plan-spark)). |
| `firebase-config.js` sin valores de ejemplo | ⏳ Faltan los 3 valores que da la consola (`apiKey`, `messagingSenderId`, `appId`). La app avisa mientras quede algún `TU_`. |
| Authentication Anónimo y Email/Password | ⏳ Se activan en la consola (Pasos 3 y 4). El código usa `signInAnonymously` y `signInWithEmailAndPassword`. |
| Las reglas permiten exactamente lo que necesita la app | ✅ Cada escritura de `photos.js`, `likes.js` y `admin.js` coincide con una regla. Todo lo demás se deniega (probado). |
| Compatibilidad de las reglas con usuarios anónimos | ✅ Solo exigen sesión y comparan UID. El admin exige proveedor no anónimo y estar en `admins`. |
| Ningún servicio de pago | ✅ `firebase.json` solo contiene `hosting` y `firestore`. El código no importa el SDK de Storage. |
| Hosting usa la carpeta correcta | ✅ `"public": "public"` en `firebase.json`. |
| No hay que ejecutar build | ✅ No hay `package.json` ni bundler. Se publica `public/` tal cual. |
| Módulos ES en Firebase Hosting | ✅ `<script type="module">`, imports relativos con extensión `.js` e imports del SDK por URL absoluta de `gstatic.com`. Probado servido por el emulador de Hosting. |
| Ruta del Service Worker | ✅ Se registra como `service-worker.js` desde `/index.html` → ámbito `/`. Tiene `Cache-Control: no-cache` en `firebase.json`. |
| URLs relativas en producción | ✅ Todas relativas (`css/…`, `js/…`, `assets/…`, `manifest.json`). La app vive en la raíz del dominio. |
| `/admin.html` al acceder directamente | ✅ Es un archivo real. No se usa reescritura SPA. El service worker no lo cachea. `/admin` sin `.html` da 404 (no hay `cleanUrls`), y es lo esperado. |
| Secretos privados en JS público | ✅ Ninguno. `firebaseConfig` es público por diseño. El código `IvAngela2026` es una barrera de interfaz (ver [🔐](#el-código-ivangela2026-está-en-el-javascript-público-es-un-problema)). |

---

# Troubleshooting

### "Firebase no conecta"
- Mensaje *"Falta configurar Firebase"*: aún están los `TU_...` en `public/js/firebase-config.js`.
- Abre la consola del navegador (F12 → *Console*) y busca errores en rojo.
- `auth/invalid-api-key` o `projectId` incorrecto: vuelve a copiar la config ([Paso 2](#paso-2--registrar-la-aplicación-web)).
- `USE_EMULATORS` debe ser `false` en producción.
- Si abriste el HTML con doble clic (`file://`), usa un servidor ([Probar en local](#probar-en-local)).
- Tras un cambio, fuerza la recarga (Ctrl+Shift+R) o incrementa `CACHE_VERSION` del service worker.

### "La CLI no encuentra el proyecto o el sitio de Hosting"
- `firebase use appboda-ivan-angela` → *Invalid project selection*: has iniciado sesión con otra cuenta (`firebase logout` + `firebase login`) o el ID real tiene sufijo ([Paso 1](#paso-1--abrir-el-proyecto-comprobar-su-id-y-el-plan-spark)).
- `firebase deploy` se queja de que no hay sitio de Hosting por defecto: haz el [Paso 12](#paso-12--preparar-firebase-hosting) (Hosting → Comenzar).
- Algo menciona **Storage** o pide **Blaze**: comprueba que `firebase.json` no tiene sección `storage` (no debe tenerla) y no actives nada de pago.

### "Permission denied" / "Missing or insufficient permissions"
- ¿Desplegaste las reglas? `firebase deploy --only firestore`. Compara en la consola (Firestore → Reglas) que el texto es el del proyecto.
- Si **subir** una foto da este error: comprueba que no has modificado `photos.js` ni subido `upload.maxBytes` por encima de 900 KB (las reglas rechazan fotos mayores).
- `auth/operation-not-allowed` o *"El acceso de invitados no está activado"*: activa **Anónimo** en Authentication → Método de acceso.
- Al **borrar** como invitado: solo funciona con fotos subidas desde ese mismo navegador (ver [limitaciones iOS](#limitaciones-de-ios)).
- Al borrar como **admin**: ¿existe el documento `admins/<tu UID>` ([Paso 7](#paso-7--dar-permisos-de-administrador-colección-admins))? ¿La base de datos es `(default)` ([Paso 6](#paso-6--crear-firestore-database))?
- Al dar like: el contador debe cambiar exactamente ±1 junto con el like; si modificaste `likes.js`, revisa que use `writeBatch`.

### "Las fotos no aparecen"
- Firestore → Datos → ¿existe la colección `photos` con documentos? Si no, la subida falló antes (mira la consola del navegador).
- *"Se ha alcanzado el límite gratuito de hoy"*: se agotaron las 50.000 lecturas diarias. Vuelve a funcionar a las 09:00 (hora de España). Las fotos no se pierden. Ver [💰](#-costes-y-límites).
- ¿El dispositivo tiene conexión? La galería se actualiza en tiempo real; prueba a recargar.

### "No puedo subir fotos"
- Mensaje "HEIC no compatible": en iPhone ocurre muy raramente (Safari convierte a JPEG). Solución: Ajustes → Cámara → Formatos → **Más compatible**, o elegir la foto desde *Fototeca* en lugar de *Archivos*.
- "Supera 40 MB": sube el límite `upload.maxOriginalSizeMB` o usa otra foto.
- *"No tienes permiso"*: reglas no desplegadas o sesión anónima no iniciada (Authentication → Anónimo).
- *"Se ha alcanzado el límite gratuito"*: escrituras del día agotadas (vuelve a las 09:00) o 1 GiB de almacenamiento lleno (descarga el ZIP y borra fotos). Ver [💰](#-costes-y-límites).
- Conexión muy lenta en el lugar: las fotos se suben de una en una; si alguna falla se queda en la lista para reintentar.

### "El administrador no puede entrar"
- *"Email o contraseña incorrectos"*: revisa el usuario en Authentication → Usuarios; restablece la contraseña.
- *"Este usuario no es administrador. UID: ..."*: crea en Firestore el documento `admins/<ese UID>` ([Paso 7](#paso-7--dar-permisos-de-administrador-colección-admins)). El ID del documento debe ser **exactamente** el UID.
- ¿Está activado el proveedor **Correo electrónico/contraseña**?
- Dominio propio: añádelo a *Dominios autorizados*.

### "La PWA no se instala"
- Debe servirse por **HTTPS** (Firebase Hosting lo hace; `http://localhost` también vale en el ordenador, pero **no** una IP local desde el móvil).
- F12 → Application → **Manifest**: sin errores y con iconos 192 y 512.
- F12 → Application → **Service workers**: registrado y activo. Si no, revisa errores en la consola.
- En iPhone: solo desde Safari (o Chrome/Edge en iOS 16.4+) mediante *Compartir → Añadir a pantalla de inicio*.
- Si ya está instalada, Chrome no vuelve a ofrecer instalarla.

### "En iPhone los botones aparecen desplazados"
- Comprueba que la etiqueta viewport de `index.html` incluye **`viewport-fit=cover`**:
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `styles.css` usa `env(safe-area-inset-top)` en la cabecera y `env(safe-area-inset-bottom)` en la barra inferior (variables `--safe-top` / `--safe-bottom`). Si has modificado esas reglas, restáuralas.
- Tras cambiar el CSS, en la app instalada hay que incrementar `CACHE_VERSION`, desplegar, abrir la app, cerrarla del todo y volver a abrirla.
- `apple-mobile-web-app-status-bar-style` está en `default` (barra de estado sobre fondo claro). Si lo cambias a `black-translucent`, el contenido pasa por debajo de la barra de estado y dependerá totalmente de `safe-area-inset-top`.

### "La descarga ZIP falla con muchas fotos"
- **Todas las fotos fallan** → revisa la conexión y que no se haya agotado la cuota de lecturas del día (cada foto del ZIP es 1 lectura).
- **Limitaciones del navegador:** el ZIP se construye **en memoria** del navegador. En un ordenador con Chrome suele funcionar bien hasta 1–2 GB por archivo; en móviles (especialmente iPhone) el límite es mucho menor y puede cerrarse la pestaña.
- Soluciones:
  1. Usa un **ordenador**, no el móvil.
  2. Reduce `admin.zipMaxPhotosPerFile` (p. ej. 150) para generar más partes pequeñas.
  3. Descarga por bloques con **Seleccionar** + **Descargar seleccionadas**.
  4. Con ~1.000 fotos de ~300 KB el ZIP ocupa ~300 MB: cualquier ordenador actual lo genera sin problema.
- No bloquees el ordenador ni cambies de pestaña mucho tiempo durante la generación.

---

# Arquitectura final

```text
                    ┌─────────────────┐
                    │   INVITADO      │
                    │   Móvil + QR    │
                    └────────┬────────┘
                             │  código de la boda (barrera de interfaz)
                             ▼
                    ┌─────────────────┐
                    │      PWA        │  Firebase Hosting (HTTPS)
                    │   HTML/CSS/JS   │  Service Worker + manifest
                    │  compresión en  │
                    │  el dispositivo │
                    └────────┬────────┘
                             │  sesión ANÓNIMA (UID sin datos personales)
              ┌──────────────┴──────────────┐
              ▼                             ▼
        ┌───────────────────────────┐   ┌──────────┐
        │ Firestore (plan Spark)    │   │  Auth    │
        │ photos/      + miniatura  │   │ Anónimo  │
        │ photoFiles/  foto 1600 px │   │ + Admin  │
        │ photos/*/likes/  admins/  │   │ (email)  │
        └───────────────────────────┘   └──────────┘
              │   reglas de seguridad (ownerId == uid, admins/{uid})
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │ PANEL ADMIN     │  /admin.html
                    │                 │
                    │ Fotos           │
                    │ Likes           │
                    │ Eliminar        │
                    │ Descargar ZIP   │  (JSZip en el navegador)
                    └─────────────────┘
```

Flujo de una subida:

```text
Elegir fotos → <img> decodifica (orientación EXIF) → <canvas> 1600 px → JPEG ≤ 450 KB
            → miniatura 360 px ≤ 60 KB
            → un lote atómico: photoFiles/{id} (foto) + photos/{id} (datos + miniatura, createdAt = hora servidor)
            → onSnapshot del bloque más reciente → galería de todos
```

---


---

# ✅ Checklist final

```text
☐ Proyecto Firebase creado (ID verificado: appboda-ivan-angela)
☐ Plan Spark confirmado (sin tarjeta, NUNCA "Actualizar a Blaze")
☐ Aplicación web registrada
☐ Authentication Anonymous activado
☐ Authentication Email/Password activado
☐ Usuario administrador creado
☐ Documento admins/{UID} creado en Firestore
☐ Firestore creado ((default), europe-southwest1, modo producción)
☐ Storage NO activado (las fotos van en Firestore)
☐ firebase-config.js configurado (sin "TU_", USE_EMULATORS = false)
☐ .firebaserc configurado
☐ firestore.rules desplegadas
☐ firestore.indexes.json desplegado (exenciones de thumb y data)
☐ Firebase Hosting configurado
☐ Primer deploy realizado
☐ Página pública comprobada
☐ Subida de fotos comprobada
☐ Likes comprobados
☐ Borrado de fotos comprobado
☐ Seguridad comprobada
☐ Panel admin comprobado
☐ Descarga ZIP comprobada
☐ Prueba desde Android
☐ Prueba desde iPhone
☐ QR generado
☐ Backup realizado
☐ Hero image configurada
☐ App lista para la boda
```
