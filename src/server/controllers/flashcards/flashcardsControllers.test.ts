import { type Response } from "express";
import { mockNext, mockResponse } from "../../../mocks/express.mock";
import { type CustomRequest } from "../../types";
import Flashcard from "../../../database/models/Flashcards";
import User from "../../../database/models/User";
import mockFlashcards from "../../../mocks/flashcards.mock";
import {
  createFlashcard,
  modifyFlashcard,
  practiceFlashcard,
} from "./flashcardsControllers";
import type CustomError from "../../../CustomError/CustomError";
import { type FlashcardModel } from "../../../database/types";
import { type SuperMemoGrade } from "supermemo";

const {
  imageInfo: { fileName, imageBackup },
  front,
  back,
  language,
} = mockFlashcards[0];
const request = {
  userId: "",
  file: {
    convertedName: fileName,
    backupUrl: imageBackup,
  },
  params: {},
} as Partial<CustomRequest> as CustomRequest;
const response = mockResponse as Response;
const next = mockNext;

const currentFlashcard: FlashcardModel = {
  ...mockFlashcards[0],
  dueDate: "2023-04-01T10:39:18+0000",
};

afterEach(() => {
  next.mockClear();
  (response.json as jest.Mock).mockClear();
});

describe("Given a createFlashcard controller", () => {
  User.findByIdAndUpdate = jest.fn().mockImplementation(() => ({
    exec: jest.fn().mockResolvedValue(true),
  }));

  describe("When it receives a flashcard", () => {
    request.body = {
      front,
      back,
      language,
      grade: 0,
    };
    test("Then it should respond with the flashcard, interval 0, repetition 0 and efactor 2.5", async () => {
      Flashcard.create = jest.fn().mockResolvedValue(currentFlashcard);

      await createFlashcard(request, response, next);

      expect(response.status).toHaveBeenLastCalledWith(201);
      expect(response.json).toHaveBeenCalledWith({
        flashcard: currentFlashcard,
      });
    });
  });

  describe("When it receives a flashcard just with the front field", () => {
    test("Then it should call next with create flashcard error", async () => {
      Flashcard.create = jest.fn().mockImplementation(() => {
        throw new Error(
          "Flashcard validation failed: missing back and language properties"
        );
      });

      await createFlashcard(request, response, next);
      const { message, publicMessage } = next.mock.calls[0][0] as CustomError;

      expect(message).toBe(
        "Flashcard validation failed: missing back and language properties"
      );
      expect(publicMessage).toBe("There was a problem creating the flashcard");
    });
  });
});

const findByIdMock = (
  flashcard: FlashcardModel,
  method: "mockResolvedValue" | "mockRejectedValue",
  methodValue: string | Error
) =>
  jest.fn().mockImplementation(() => ({
    exec: jest.fn().mockResolvedValue({
      ...flashcard,
      $set: jest.fn().mockImplementation(function (flashcard: FlashcardModel) {
        Object.assign(this, flashcard);
      }),
      save: jest.fn()[method](methodValue),
    }),
  }));

describe("Given a modifyFlashcard controller", () => {
  const flashcard: FlashcardModel = {
    ...currentFlashcard,
    interval: 4,
    efactor: 3,
    repetition: 2,
  };

  describe("When it receives a request with param '6422f11dded99925cb179372' and equal front and back info", () => {
    test("Then it should respond with the updated flashcard info and the same spaced repetition info", async () => {
      Flashcard.findById = findByIdMock(flashcard, "mockResolvedValue", "");

      await modifyFlashcard(request, response, next);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        flashcard: expect.objectContaining({
          ...flashcard,
        }) as FlashcardModel,
      });
    });
  });

  describe("When it receives a request with param '6422f11dded99925cb179372' and different front and back info", () => {
    test("Then it should respond with the updated flashcard info and reset spaced repetion info", async () => {
      request.params.flashcardId = "6422f11dded99925cb179372";
      request.body = {
        front: "Welcome",
        back: "Bienvenido",
        language: "English",
        grade: 0,
      };

      Flashcard.findById = findByIdMock(flashcard, "mockResolvedValue", "");

      await modifyFlashcard(request, response, next);

      expect(response.status).toHaveBeenCalledWith(200);
      expect(response.json).toHaveBeenCalledWith({
        flashcard: expect.objectContaining({
          ...request.body,
          efactor: 2.5,
          interval: 0,
          repetition: 0,
        }) as FlashcardModel,
      });
    });
  });

  describe("When it can't save the modified flashcard", () => {
    test("Then it should call next with modifyFlashcard error", async () => {
      Flashcard.findById = findByIdMock(
        flashcard,
        "mockRejectedValue",
        new Error("There was a problem saving the flashcard")
      );

      await modifyFlashcard(request, response, next);
      const { message, publicMessage } = next.mock.calls[0][0] as CustomError;

      expect(message).toBe("There was a problem saving the flashcard");
      expect(publicMessage).toBe("Couldn't modify the flashcard");
    });
  });
});

describe("Given a practiceFlashcard controller", () => {
  const flashcard: FlashcardModel = {
    ...currentFlashcard,
  };

  describe("When it receives a request with grade 5", () => {
    test("Then it should respond with the flashcard, interval 1, repetition 1, efactor 2.6 and dueDate '2023-04-02T10:39:18.000Z'", async () => {
      jest.useFakeTimers().setSystemTime(new Date(flashcard.dueDate));
      request.body.grade = 5;
      Flashcard.findById = findByIdMock(flashcard, "mockResolvedValue", "");

      await practiceFlashcard(request, response, next);

      expect(response.json).toHaveBeenCalledWith({
        flashcard: expect.objectContaining({
          ...flashcard,
          efactor: 2.6,
          interval: 1,
          repetition: 1,
          dueDate: "2023-04-02T10:39:18.000Z",
        }) as FlashcardModel,
      });

      jest.useRealTimers();
    });
  });

  describe("When it receives a request with grade 6", () => {
    test("Then it should call next with practice error", async () => {
      request.body.grade = 6 as SuperMemoGrade;

      await practiceFlashcard(request, response, next);
      const { message, publicMessage } = next.mock.calls[0][0] as CustomError;

      expect(message).toBe("Invalid grade");
      expect(publicMessage).toBe("Couldn't set the next due date");
    });
  });
});
