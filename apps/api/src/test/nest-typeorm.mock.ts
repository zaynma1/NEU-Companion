export const InjectRepository = () => () => undefined;
export const TypeOrmModule = {
  forFeature: () => ({ module: class MockTypeOrmModule {} }),
  forRoot: () => ({ module: class MockTypeOrmModule {} }),
  forRootAsync: () => ({ module: class MockTypeOrmModule {} }),
};
