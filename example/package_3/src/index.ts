import { ApiRequestOne } from "package_1";

export interface ApiRequestThree {
    test: string
}
export const methodThree = (test: ApiRequestOne) => {
    return 1;
}