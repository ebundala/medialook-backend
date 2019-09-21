
// eslint-disable-next-line max-classes-per-file
export class ApiSuccess {
  constructor(data, code = 200, message = 'OK') {
    this.data = data;
    this.code = code;
    this.message = message;
  }

  /* toJSON() {
    return JSON.stringify({ data: this.data, code: this.code, message: this.message });
  } */
}

export class ApiError {
  constructor(error, code = 400, message = 'Bad request') {
    this.error = error;
    this.code = code;
    this.message = message;
  }

  /* toJSON() {
    return JSON.stringify({ error: this.error, code: this.code, message: this.message });
  } */
}
