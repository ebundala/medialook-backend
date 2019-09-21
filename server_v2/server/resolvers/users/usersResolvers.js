// eslint-disable-next-line import/no-extraneous-dependencies
import faker from 'faker';

const usersResolver = () => {
  const users = [];

  for (let index = 0; index < 30; index += 1) {
    users.push(
      {
        username: faker.name.findName(),
        avator: faker.internet.avatar(),
        bio: faker.lorem.lines(3),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        gender: 'male',
      },
    );
  }
  return users;
};

export default usersResolver;
