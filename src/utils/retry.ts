import axios from 'axios';

export const retry = async (error: any) => {
  const {
    response: { status },
    config,
  } = error;

  if (status === 429) {
    const retryAfterHeader = error.response.headers['retry-after'];
    if (retryAfterHeader) {
      const retryAfter = parseInt(retryAfterHeader);
      await new Promise(resolve =>
        setTimeout(() => resolve(axios(config)), retryAfter)
      );
    }
  }

  return Promise.reject(error);
};

export default retry;
