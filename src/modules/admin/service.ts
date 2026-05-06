import { db } from "../../db";
import { users, subjects, themes, quizes, summaries, usersToRoles, files } from "../../db/schema";
import { eq, count, and, sql, desc } from "drizzle-orm";
import { status } from "elysia";

export class AdminService {
  async getStats() {
    const [usersCount] = await db.select({ count: count() }).from(users);
    const [subjectsCount] = await db.select({ count: count() }).from(subjects);
    const [themesCount] = await db.select({ count: count() }).from(themes);
    const [quizesCount] = await db.select({ count: count() }).from(quizes);
    const [summariesCount] = await db.select({ count: count() }).from(summaries);

    return {
      users: usersCount.count,
      subjects: subjectsCount.count,
      themes: themesCount.count,
      quizes: quizesCount.count,
      summaries: summariesCount.count,
    };
  }

  async getDetailedStats() {
    // 1. Распределение контента
    const [quizesCount] = await db.select({ value: count() }).from(quizes);
    const [summariesCount] = await db.select({ value: count() }).from(summaries);
    const [filesCount] = await db.select({ value: count() }).from(files);
    
    const contentDistribution = [
      { name: "Тесты", value: quizesCount.value },
      { name: "Конспекты", value: summariesCount.value },
      { name: "Файлы", value: filesCount.value },
    ];

    // 2. Рост пользователей 
    let userGrowth: Array<{ month: string; users: number }> = [];
    try {
      const userGrowthRaw = await db
        .select({
          month: sql<string>`TO_CHAR(${users.date_created}, 'YYYY-MM')`,
          users: count(),
        })
        .from(users)
        .groupBy(sql`TO_CHAR(${users.date_created}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${users.date_created}, 'YYYY-MM')`)
        .limit(6);
      userGrowth = userGrowthRaw.map((row) => ({
        month: new Date(row.month + "-01").toLocaleString("ru", { month: "short" }),
        users: row.users,
      }));
    } catch (err) {
      console.warn("Не удалось получить рост пользователей:", err);
      userGrowth = [];
    }

    // 3. Активность за последние 7 дней 
    let activityByDay: Array<{ day: string; активность: number }> = [];
    // Если у таблиц нет полей даты, просто оставляем пустой массив
    // Можно также проверить наличие колонок через схему, но для простоты:
    activityByDay = []; // пока пусто, потому что полей даты нет
    console.log("Detailed stats:", { activityByDay, contentDistribution, userGrowth });
    return {
      activityByDay,
      contentDistribution,
      userGrowth,
    };
  }
  
  // User
  async getAllUsers() {
    return await db.query.users.findMany({
      with: {
        usersToRoles: {
          with: {
            role: true
          }
        }
      }
    })
  }

  async updateUserRole(userId: string, roleId: number) {
    // Проверяем, есть ли уже роль
    const existing = await db.query.usersToRoles.findFirst({
      where: eq(usersToRoles.userId, userId)
    })

    if (existing) {
      await db.update(usersToRoles)
        .set({ roleId })
        .where(eq(usersToRoles.userId, userId))
    } else {
      await db.insert(usersToRoles).values({ userId, roleId })
    }

    return { success: true }
  }

  async deleteUser(userId: string) {
    // Проверяем, является ли пользователь администратором
    const userRoles = await db.query.usersToRoles.findFirst({
      where: eq(usersToRoles.userId, userId),
      with: { role: true }
    });
    if (userRoles?.role?.slug === 'admin') {
      throw status(403, 'Нельзя удалить администратора');
    }
    await db.delete(users).where(eq(users.id, userId));
    return { success: true };
  }

  async getAllRoles() {
  return await db.query.roles.findMany();
  }

  // Quizes
  async getAllQuizes() {
  return await db.query.quizes.findMany({
    with: {
      theme: {
        with: {
          subject: true,
        },
      },
    },
    orderBy: (quizes, { desc }) => [desc(quizes.id)],
  });
  }

  // Summaries
  async getAllSummaries() {
  return await db.query.summaries.findMany({
    with: {
      subject: true,
      theme: true,
      file: true,
    },
    orderBy: (summaries, { desc }) => [desc(summaries.id)],
  });
 }

 // Subjects
 async getAllSubjects() {
  return await db.query.subjects.findMany({
    with: {
      themes: true,  
    },
    orderBy: (subjects, { asc }) => [asc(subjects.name)], 
  });
  }

  async createSubject(data: {
    name: string;
    shortName: string;
    yearStart: number;
    yearEnd: number;
    description?: string;
    }) {
      // Проверка, что год окончания больше года начала
      if (data.yearEnd <= data.yearStart) {
        throw status(400, "Год окончания должен быть позже года начала");
      }

      const [subject] = await db.insert(subjects).values({
        name: data.name,
        shortName: data.shortName,
        yearStart: data.yearStart,
        yearEnd: data.yearEnd,
        description: data.description || null,
      }).returning();

      return subject;
  }

  async updateSubject(id: number, data: {
    name: string;
    shortName: string;
    yearStart: number;
    yearEnd: number;
    description?: string;
  }) {
    if (data.yearEnd < data.yearStart) {
      throw status(400, "Год окончания должен быть позже года начала");
    }
    const [subject] = await db.update(subjects)
      .set({
        name: data.name,
        shortName: data.shortName,
        yearStart: data.yearStart,
        yearEnd: data.yearEnd,
        description: data.description ?? null,
      })
      .where(eq(subjects.id, id))
      .returning();
    if (!subject) throw status(404, "Предмет не найден");
    return subject;
  }

  async deleteSubject(id: number) {
    // Проверяем, есть ли у предмета связанные темы (чтобы не нарушить ссылочную целостность)
    const themesCount = await db.select({ count: count() }).from(themes).where(eq(themes.subjectId, id));
    if (themesCount[0].count > 0) {
      throw status(409, "Нельзя удалить предмет, у которого есть темы");
    }

    await db.delete(subjects).where(eq(subjects.id, id));
    return { success: true };
  }

  // Themes
  async getAllThemes() {
    return await db.query.themes.findMany({
      with: {
        subject: true,
      },
      orderBy: (themes, { asc }) => [asc(themes.name)],
    });
  }

  async createTheme(data: {
    name: string;
    description?: string;
    subjectId: number;
  }) {
    // Проверяем, существует ли предмет
    const subject = await db.query.subjects.findFirst({
      where: eq(subjects.id, data.subjectId),
    });
    if (!subject) {
      throw status(404, "Предмет не найден");
    }

    const [theme] = await db.insert(themes).values({
      name: data.name,
      description: data.description ?? null,
      subjectId: data.subjectId,
    }).returning();

    return theme;
  }

  async updateTheme(id: number, data: {
    name: string;
    description?: string;
    subjectId: number;
  }) {
    // Проверяем существование предмета
    const subject = await db.query.subjects.findFirst({
      where: eq(subjects.id, data.subjectId),
    });
    if (!subject) {
      throw status(404, "Предмет не найден");
    }

    const [theme] = await db.update(themes)
      .set({
        name: data.name,
        description: data.description ?? null,
        subjectId: data.subjectId,
      })
      .where(eq(themes.id, id))
      .returning();

    if (!theme) {
      throw status(404, "Тема не найдена");
    }
    return theme;
  }

  async deleteTheme(id: number) {
    // Проверяем, есть ли у темы связанные конспекты или тесты (опционально)
    const summariesCount = await db.select({ count: count() }).from(summaries).where(eq(summaries.themeId, id));
    const quizesCount = await db.select({ count: count() }).from(quizes).where(eq(quizes.themeId, id));
    if (summariesCount[0].count > 0 || quizesCount[0].count > 0) {
      throw status(409, "Нельзя удалить тему, у которой есть конспекты или тесты");
    }

    await db.delete(themes).where(eq(themes.id, id));
    return { success: true };
  }


    
};



