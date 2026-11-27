// Mock server used in tests. An unhandled request is an error and does not reach the network.
import { setupServer } from 'msw/node';

import { handlers } from './handlers';

export const mockServer = setupServer(...handlers);
