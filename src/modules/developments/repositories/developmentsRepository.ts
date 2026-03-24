import { developmentsMock } from "../mocks/developmentsMock";

export function getDevelopments(accountId: string) {
  return developmentsMock.filter((development) => development.accountId === accountId);
}
