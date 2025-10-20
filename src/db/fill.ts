import { eq, sql } from "drizzle-orm";
import { db } from ".";
import { subjects, themes } from "./schema";

export async function fillDefault() {
  await db.execute(sql`TRUNCATE TABLE "thesis"."themes" CASCADE;`);
  await db.execute(sql`TRUNCATE TABLE "thesis"."subjects" CASCADE;`);
  await fillSubject();
  await fillThemes();
}

export async function fillSubject() {
  await db
    .insert(subjects)
    .values([
      {
        id: 1,
        shortName: "ПиОА 1",
        name: "Программирование и основы алгоритмизации 1",
        description:
          "Дисциплина является начальным курсом для развития знаний и навыков в области программирования и алгоритмизации. Знание основ программирования позволит студентам сформировать для себя требования к современной парадигме разработки программного обеспечения. Дисциплина предполагает на понятном студентам языке объяснить основные понятия языка программирования Python, научить решать основные программные задачи, отлаживать и тестировать программы, таким образом дать студентам основные навыки, требуемые в сфере Информационных технологий и алгоритмизации.",
        yearStart: 2025,
        yearEnd: 2026,
      },
    ])
    .onConflictDoNothing();
}

export async function fillThemes() {
  const piwo1 = await db.query.subjects.findFirst({
    where: eq(subjects.shortName, "ПиОА 1"),
  });

  if (!piwo1) throw new Error("ПиОА 1 not found");

  await db.insert(themes).values([
    {
      subjectId: piwo1.id,
      name: "Основные принципы организации Языка Python. Базовые элементы программирования и типы данных",
    },
    {
      subjectId: piwo1.id,
      name: "Управляющие конструкции",
    },
    {
      subjectId: piwo1.id,
      name: "Организация функций",
    },
    {
      subjectId: piwo1.id,
      name: "Работа со строками и текстом",
    },
    {
      subjectId: piwo1.id,
      name: "Коллекции. Работа с файлами",
    },
    {
      subjectId: piwo1.id,
      name: "Элементы функционального программирования",
    },
  ]);
}

// how to run this file
if (import.meta.main) {
  fillDefault()
    .then(() => {
      console.log("Default data filled");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error filling default data", err);
      process.exit(1);
    });
}
