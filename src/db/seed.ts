import { db } from "./index";
import { roles, permissions, rolesToPermissions } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Начальное заполнение БД...");

  // Роли (существующая таблица, новые данные)
  const rolesData = [
    { title: 'Администратор', slug: 'admin', description: 'Полный доступ' },
    { title: 'Преподаватель', slug: 'teacher', description: 'Создание материалов' },
    { title: 'Студент', slug: 'student', description: 'Базовый доступ' },
  ];

  for (const role of rolesData) {
    await db.insert(roles).values(role).onConflictDoNothing();
  }

  const permissionsData = [
    { title: 'Создание тестов', slug: 'create_quiz', description: 'Может создавать тесты' },
    { title: 'Создание конспектов', slug: 'create_summary', description: 'Может создавать конспекты' },
    { title: 'Просмотр файлов', slug: 'view_files', description: 'Может просматривать файлы' },
    { title: 'Загрузка файлов', slug: 'upload_files', description: 'Может загружать файлы' },
    { title: 'Создание предмета', slug: 'create_subject', description: 'Может создавать предметы' },
    { title: 'Создание темы', slug: 'create_theme', description: 'Может создавать темы' },
    { title: 'Просмотр вопросов', slug: 'view_questions', description: 'Может просматривать вопросы' },
    { title: 'Обновление вопроса', slug: 'update_question', description: 'Может обновлять основные данные вопроса' },
    { title: 'Обновление вариантов', slug: 'update_question_variants', description: 'Может обновлять варианты ответов' },
    { title: 'Обновление matching', slug: 'update_question_matching', description: 'Может обновлять конфигурацию matching-вопросов' },
    { title: 'Просмотр всех сессий', slug: 'view_all_sessions', description: 'Может просматривать сессии всех пользователей' }
  ];

  for (const perm of permissionsData) {
    await db.insert(permissions).values(perm).onConflictDoNothing();
  }

  // Назначение прав ролям
  const adminRole = await db.query.roles.findFirst({ where: eq(roles.slug, 'admin') });
  const teacherRole = await db.query.roles.findFirst({ where: eq(roles.slug, 'teacher') });
  const studentRole = await db.query.roles.findFirst({ where: eq(roles.slug, 'student') });
  
  const allPerms = await db.select().from(permissions);
  
  for (const perm of allPerms) {
    await db.insert(rolesToPermissions).values({
      roleId: adminRole.id,
      permissionId: perm.id
    }).onConflictDoNothing();
  }
  
  const teacherPerms = allPerms.filter(p => 
    ['create_quiz', 'create_summary', 'view_files', 'upload_files', 'create_subject', 'create_theme', 'view_questions', 'update_question', 'update_question_variants', 'update_question_matching'].includes(p.slug)
  );
  for (const perm of teacherPerms) {
    await db.insert(rolesToPermissions).values({
      roleId: teacherRole.id,
      permissionId: perm.id
    }).onConflictDoNothing();
  }

  console.log("Начальные данные добавлены");
}

// Запуск: bun run src/db/seed.ts
seed().catch(console.error);