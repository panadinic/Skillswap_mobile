# CONTEXT.md (lite)

## Proyecto
SkillSwap: red social para intercambiar habilidades, stack **React + Firebase** (Auth, Firestore y Storage opcional).

## Estado
Antes se podían crear usuarios y posts y aparecían en el Home; hoy **no se están creando cuentas ni posts** correctamente.

## Flujo clave
login → registrar cuenta → cuenta creada → home → botón de publicaciones → escribir publicación → post publicado en el feed.

## Objetivo
Diagnosticar y corregir: (1) alta de usuario (doc en `/users/{uid}`) y (2) creación de post (doc en `/posts` con `status='published'`) para que **aparezcan en Home**.

## Hechos deseados (DoD)
- Tras primer login: `/users/{uid}` creado/actualizado con `uid,email,displayName,createdAt`.
- Crear post: `/posts/{id}` con `title,content,imageUrl?,status='published',authorUid,createdAt=serverTimestamp()`.
- Home: consulta `/posts` donde `status='published'` ordenado por `createdAt desc` (máx 50).
- Reglas Firestore/Storage alineadas para permitir lo anterior.

## Tareas para la IA
1) Mapear inicialización de Firebase y helpers (`ensureUserDoc`, `createPost`, `fetchFeed`).  
2) Verificar rutas/colecciones (`users`,`posts`), campos (`status`,`createdAt`) e índices.  
3) Arreglar lo mínimo para que registro y post funcionen y se vean en Home.  
4) Agregar logs/errores legibles si falla algo.
