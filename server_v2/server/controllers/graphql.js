import { ApolloServer } from 'apollo-server-express';
import typeDefs from '../schemas/schema';
import resolvers from '../resolvers/resolvers';
import sessionTokenAuth from '../middlewares/tokenAuth';
import UsersDataSource from '../models/Users';
import FeedDataSource from '../models/Feeds';
import ReportDataSource from '../models/Reports';
import CommentsDatasource from '../models/Comments';
import PostsDatasource from '../models/Posts';
import NotificationsDatasource from '../models/Notifications';
import postsCountLoader from '../dataloaders/postsCountLoader';
import commentsCountLoader from '../dataloaders/commentsCountLoader';
import likesCountLoader from '../dataloaders/likesCountLoader';
import reportsCountLoader from '../dataloaders/reportsCountLoader';
import followingCountLoader from '../dataloaders/followingCountLoader';
import followersCountLoader from '../dataloaders/followersCountLoader';
import isLikedLoader from '../dataloaders/isLikedLoader';
import isFollowedLoader from '../dataloaders/isFollowedLoader';
import isCommentedLoader from '../dataloaders/isCommentedLoader';

export default new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const user = await sessionTokenAuth(req);
    return {
      user,
      dataloaders: {
        postsCount: postsCountLoader(),
        commentsCount: commentsCountLoader(),
        likesCount: likesCountLoader(),
        reportsCount: reportsCountLoader(),
        followingsCount: followingCountLoader(),
        followersCount: followersCountLoader(),
        isLiked: isLikedLoader(user),
        isFollowed: isFollowedLoader(user),
        isCommented: isCommentedLoader(user),

      },
    };
  },
  dataSources: () => ({
    users: new UsersDataSource(),
    feeds: new FeedDataSource(),
    reports: new ReportDataSource(),
    comments: new CommentsDatasource(),
    posts: new PostsDatasource(),
    notifications: new NotificationsDatasource(),
  }),
});
