const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const HttpError = require('../models/http-error');
const User = require('../models/user');

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, '-password');
  } catch (err) {
    const error = new HttpError(
      '사용자 목록 데이터를 가져오는데 실패하였습니다. 나중에 다시 시도해주세요.',
      500
    );
    return next(error);
  }

  res.json({ users: users.map((user) => user.toObject({ getters: true })) });
};

const signUp = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError(
        '유효하지 않은 입력 데이터를 전달했습니다. 데이터를 확인하세요.',
        422
      )
    );
  }

  const { name, email, password } = req.body;

  // uniqueValidator 패키지에서 불러온 유효성 검사를 사용하면
  // 기술적인 메시지가 전달될 가능성 존재
  // 그래서 수동 유효성 검사 로직 추가.
  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      '회원가입에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      '해당 이메일을 사용하는 사용자가 이미 존재합니다. 로그인 하세요.',
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    // 평문 비밀번호 해쉬
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError(
      '회원가입에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: [],
  });

  try {
    // 모델의 인스턴스로 데이터베이스 문서 생성
    await createdUser.save();
  } catch (err) {
    const error = new HttpError(
      '회원가입에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  let token;
  try {
    // sign(인코딩할 데이터, 프라이빗키, 옵션 객체): 토큰 생성 함수
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    const error = new HttpError(
      '회원가입에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  res.status(201).json({
    message: '회원가입에 성공하였습니다.',
    userId: createdUser.id,
    email: createdUser.email,
    token: token,
  });
};

const login = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError(
      '유효하지 않은 입력 데이터를 전달했습니다. 데이터를 확인하세요.',
      422
    );
  }

  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      '로그인에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      '유효하지 않은 자격 증명으로 인해 로그인할 수 없습니다.',
      403
    );
    return next(error);
  }

  let isValidPassword = false;
  try {
    // compare(): 평문 비밀번호와 데이터베이스에 저장되있는 해쉬 비밀번호가 일치한지 비교하는 함수
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError(
      '로그인에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      '유효하지 않은 자격 증명으로 인해 로그인할 수 없습니다.',
      401
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );
  } catch (err) {
    const error = new HttpError(
      '로그인에 실패했습니다. 나중에 다시 시도하세요.',
      500
    );
    return next(error);
  }

  res.json({
    message: '로그인에 성공하였습니다.',
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signUp = signUp;
exports.login = login;
