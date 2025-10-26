import { eq, sql } from "drizzle-orm";
import { db } from ".";
import {
  subjects,
  themes,
  quizes,
  questions,
  variants,
  questionsVariants,
  quizesQuestions,
} from "./schema";

export async function fillDefault() {
  await db.execute(sql`TRUNCATE TABLE "thesis"."themes" CASCADE;`);
  await db.execute(sql`TRUNCATE TABLE "thesis"."subjects" CASCADE;`);
  await fillSubject();
  await fillThemes();

  const nodeEnv = process.env.NODE_ENV || "development";
  if (nodeEnv === "testing" || nodeEnv === "development") {
    await fillQuizes();
  }
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

export async function fillQuizes() {
  console.log("Filling quizes...");

  const allThemes = await db.query.themes.findMany();

  if (allThemes.length === 0) {
    throw new Error("No themes found to create quizes");
  }

  for (const theme of allThemes) {
    await createQuizForTheme(theme.id, theme.name);
  }

  console.log(`Created quizes for ${allThemes.length} themes`);
}

async function createQuizForTheme(themeId: number, themeName: string) {
  // Create a quiz for this theme
  const [quiz] = await db
    .insert(quizes)
    .values({
      type: "mixed",
      name: `Тест: ${themeName}`,
      description: `Комплексный тест по теме "${themeName}" с различными типами вопросов`,
      themeId: themeId,
    })
    .returning();

  console.log(`Created quiz for theme: ${themeName}`);

  // Create questions of different types
  await createMultiChoiceQuestion(quiz.id, themeName);
  await createTrueFalseQuestion(quiz.id, themeName);
  await createShortAnswerQuestion(quiz.id, themeName);
  await createMatchingQuestion(quiz.id, themeName);
  await createNumericalQuestion(quiz.id, themeName);
  await createEssayQuestion(quiz.id, themeName);
}

async function createMultiChoiceQuestion(quizId: string, themeName: string) {
  const questionTypes = [
    {
      text: `Какое из следующих утверждений верно относительно темы "${themeName}"?`,
      variants: [
        {
          text: "Python - интерпретируемый язык программирования",
          isRight: true,
          explainRight: "Верно! Python является интерпретируемым языком.",
          explainWrong:
            "Неверно. Python действительно является интерпретируемым языком.",
        },
        {
          text: "Python - компилируемый язык программирования",
          isRight: false,
          explainRight: "Неверно. Python является интерпретируемым языком.",
          explainWrong:
            "Правильно! Это неверное утверждение. Python - интерпретируемый язык.",
        },
        {
          text: "Python не поддерживает объектно-ориентированное программирование",
          isRight: false,
          explainRight: "Неверно. Python полностью поддерживает ООП.",
          explainWrong: "Правильно! Это неверное утверждение.",
        },
        {
          text: "Python использует динамическую типизацию",
          isRight: true,
          explainRight:
            "Верно! Python использует динамическую типизацию данных.",
          explainWrong:
            "Неверно. Python действительно использует динамическую типизацию.",
        },
      ],
    },
    {
      text: `Выберите правильное определение переменной в Python:`,
      variants: [
        {
          text: "x = 10",
          isRight: true,
          explainRight: "Верно! Это корректное объявление переменной в Python.",
          explainWrong:
            "Неверно. Это правильный синтаксис объявления переменной.",
        },
        {
          text: "int x = 10;",
          isRight: false,
          explainRight: "Неверно. В Python не нужно указывать тип переменной.",
          explainWrong: "Правильно! Это синтаксис C/Java, не Python.",
        },
        {
          text: "var x = 10;",
          isRight: false,
          explainRight: "Неверно. Ключевое слово var не используется в Python.",
          explainWrong: "Правильно! Это синтаксис JavaScript, не Python.",
        },
      ],
    },
  ];

  const randomQuestionData =
    questionTypes[Math.floor(Math.random() * questionTypes.length)];

  const [question] = await db
    .insert(questions)
    .values({
      type: "multichoice",
      text: randomQuestionData.text,
    })
    .returning();

  // Link question to quiz
  await db.insert(quizesQuestions).values({
    quizId: quizId,
    questionId: question.id,
  });

  // Create variants for this question
  for (const variantData of randomQuestionData.variants) {
    const [variant] = await db
      .insert(variants)
      .values({
        text: variantData.text,
        explainRight: variantData.explainRight,
        explainWrong: variantData.explainWrong,
      })
      .returning();

    await db.insert(questionsVariants).values({
      questionId: question.id,
      variantId: variant.id,
      isRight: variantData.isRight,
    });
  }
}

async function createTrueFalseQuestion(quizId: string, themeName: string) {
  const questionTypes = [
    {
      text: "В Python переменные должны быть объявлены с указанием типа данных",
      isTrue: false,
    },
    {
      text: "Функция print() используется для вывода данных на экран",
      isTrue: true,
    },
    {
      text: "Python поддерживает множественное наследование",
      isTrue: true,
    },
    {
      text: "Списки в Python являются неизменяемыми структурами данных",
      isTrue: false,
    },
  ];

  const randomQuestion =
    questionTypes[Math.floor(Math.random() * questionTypes.length)];

  const [question] = await db
    .insert(questions)
    .values({
      type: "truefalse",
      text: randomQuestion.text,
    })
    .returning();

  await db.insert(quizesQuestions).values({
    quizId: quizId,
    questionId: question.id,
  });

  // Create True variant
  const [trueVariant] = await db
    .insert(variants)
    .values({
      text: "Истина",
      explainRight: randomQuestion.isTrue
        ? "Верно! Это утверждение истинно."
        : "Неверно. Это утверждение ложно.",
      explainWrong: randomQuestion.isTrue
        ? "Неверно. Это утверждение истинно."
        : "Верно! Это утверждение действительно ложно.",
    })
    .returning();

  await db.insert(questionsVariants).values({
    questionId: question.id,
    variantId: trueVariant.id,
    isRight: randomQuestion.isTrue,
  });

  // Create False variant
  const [falseVariant] = await db
    .insert(variants)
    .values({
      text: "Ложь",
      explainRight: !randomQuestion.isTrue
        ? "Верно! Это утверждение ложно."
        : "Неверно. Это утверждение истинно.",
      explainWrong: !randomQuestion.isTrue
        ? "Неверно. Это утверждение ложно."
        : "Верно! Вы правильно определили, что утверждение истинно.",
    })
    .returning();

  await db.insert(questionsVariants).values({
    questionId: question.id,
    variantId: falseVariant.id,
    isRight: !randomQuestion.isTrue,
  });
}

async function createShortAnswerQuestion(quizId: string, themeName: string) {
  const questionTypes = [
    {
      text: "Какое ключевое слово используется для определения функции в Python?",
      answer: "def",
    },
    {
      text: "Какой метод используется для добавления элемента в конец списка?",
      answer: "append",
    },
    {
      text: "Какой оператор используется для возведения числа в степень?",
      answer: "**",
    },
  ];

  const randomQuestion =
    questionTypes[Math.floor(Math.random() * questionTypes.length)];

  const [question] = await db
    .insert(questions)
    .values({
      type: "shortanswer",
      text: randomQuestion.text,
    })
    .returning();

  await db.insert(quizesQuestions).values({
    quizId: quizId,
    questionId: question.id,
  });

  const [variant] = await db
    .insert(variants)
    .values({
      text: randomQuestion.answer,
      explainRight: `Верно! Правильный ответ: ${randomQuestion.answer}`,
      explainWrong: `Неверно. Правильный ответ: ${randomQuestion.answer}`,
    })
    .returning();

  await db.insert(questionsVariants).values({
    questionId: question.id,
    variantId: variant.id,
    isRight: true,
  });
}

async function createMatchingQuestion(quizId: string, themeName: string) {
  const [question] = await db
    .insert(questions)
    .values({
      type: "matching",
      text: "Сопоставьте типы данных с их примерами:",
    })
    .returning();

  await db.insert(quizesQuestions).values({
    quizId: quizId,
    questionId: question.id,
  });

  const pairs = [
    {
      left: "int",
      right: "42",
      isCorrect: true,
    },
    {
      left: "str",
      right: "'Hello'",
      isCorrect: true,
    },
    {
      left: "list",
      right: "[1, 2, 3]",
      isCorrect: true,
    },
    {
      left: "dict",
      right: "{'key': 'value'}",
      isCorrect: true,
    },
    {
      left: "bool",
      right: "True",
      isCorrect: true,
    },
  ];

  for (const pair of pairs) {
    const [variant] = await db
      .insert(variants)
      .values({
        text: `${pair.left} → ${pair.right}`,
        explainRight: `Верно! ${pair.left} соответствует ${pair.right}`,
        explainWrong: `Неверно. Правильное соответствие: ${pair.left} → ${pair.right}`,
      })
      .returning();

    await db.insert(questionsVariants).values({
      questionId: question.id,
      variantId: variant.id,
      isRight: pair.isCorrect,
    });
  }
}

async function createNumericalQuestion(quizId: string, themeName: string) {
  const questionTypes = [
    {
      text: "Чему равно значение выражения: 2 ** 3 + 5?",
      answer: "13",
    },
    {
      text: "Сколько элементов в списке после выполнения: list = [1, 2, 3]; list.append(4)?",
      answer: "4",
    },
    {
      text: "Какой результат вернет len('Python')?",
      answer: "6",
    },
  ];

  const randomQuestion =
    questionTypes[Math.floor(Math.random() * questionTypes.length)];

  const [question] = await db
    .insert(questions)
    .values({
      type: "numerical",
      text: randomQuestion.text,
    })
    .returning();

  await db.insert(quizesQuestions).values({
    quizId: quizId,
    questionId: question.id,
  });

  const [variant] = await db
    .insert(variants)
    .values({
      text: randomQuestion.answer,
      explainRight: `Верно! Правильный ответ: ${randomQuestion.answer}`,
      explainWrong: `Неверно. Правильный ответ: ${randomQuestion.answer}`,
    })
    .returning();

  await db.insert(questionsVariants).values({
    questionId: question.id,
    variantId: variant.id,
    isRight: true,
  });
}

async function createEssayQuestion(quizId: string, themeName: string) {
  const questionTypes = [
    `Объясните основные принципы темы "${themeName}" своими словами.`,
    `Приведите практический пример использования концепций из темы "${themeName}".`,
    `Опишите преимущества и недостатки подходов, рассмотренных в теме "${themeName}".`,
  ];

  const randomText =
    questionTypes[Math.floor(Math.random() * questionTypes.length)];

  const [question] = await db
    .insert(questions)
    .values({
      type: "essay",
      text: randomText,
    })
    .returning();

  await db.insert(quizesQuestions).values({
    quizId: quizId,
    questionId: question.id,
  });

  // Essay questions don't have predefined variants
  const [variant] = await db
    .insert(variants)
    .values({
      text: "Свободный ответ",
      explainRight:
        "Ваш ответ будет оценен преподавателем. Убедитесь, что вы полностью раскрыли тему.",
      explainWrong: "Развернутый ответ требует проверки преподавателем.",
    })
    .returning();

  await db.insert(questionsVariants).values({
    questionId: question.id,
    variantId: variant.id,
    isRight: true,
  });
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
