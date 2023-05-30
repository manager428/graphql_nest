import { validatePayloadRequiredKeys } from '../../shared/validatePayloadRequiredKeys';

describe('Test payload validation', () => {
  it('should return missing keys (email, password)', () => {
    const requiredKeys = ['first_name', 'last_name', 'email', 'password'];
    const payload = {
      first_name: '',
      last_name: '',
    };

    expect(() => validatePayloadRequiredKeys(requiredKeys, payload)).toThrow(
      `Missing required keys in payload: email,password`,
    );
  });

  it('should return missing keys (first_name, password)', () => {
    const requiredKeys = ['first_name', 'last_name', 'email', 'password'];
    const payload = {
      email: '',
      last_name: '',
    };

    expect(() => validatePayloadRequiredKeys(requiredKeys, payload)).toThrow(
      `Missing required keys in payload: first_name,password`,
    );
  });
});
