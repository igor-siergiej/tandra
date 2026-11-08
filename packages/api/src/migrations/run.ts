import 'dotenv/config';
import { config } from '../config';
import { dependencyContainer, registerDepdendencies } from '../dependencies';
import { DependencyToken } from '../dependencies/types';
import { migrateFriendsFromExistingShares } from './friendsFromExistingShares';

/** One-off manual migration: run via `bun run src/migrations/run.ts`. */
const run = async () => {
    registerDepdendencies();

    const logger = dependencyContainer.resolve(DependencyToken.Logger);
    const database = dependencyContainer.resolve(DependencyToken.Database);

    await database.connect({
        connectionUri: config.get('connectionUri'),
        databaseName: config.get('databaseName'),
    });
    logger.info('Connected to database');

    const { created } = await migrateFriendsFromExistingShares({
        listRepo: dependencyContainer.resolve(DependencyToken.ListRepository),
        recipeRepo: dependencyContainer.resolve(DependencyToken.RecipeRepository),
        friendRepo: dependencyContainer.resolve(DependencyToken.FriendRepository),
        idGenerator: dependencyContainer.resolve(DependencyToken.IdGenerator),
    });

    logger.info('Migrated existing shared lists/recipes into friendships', { created });
    process.exit(0);
};

run();
