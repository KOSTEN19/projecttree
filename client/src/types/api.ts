/** Mirrors Go JSON in server-go/internal/models (UserClient, PersonClient, …). */

export type UserClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  login: string;
  sex: string;
  birthDate: string;
  birthCity: string;
  birthCityCustom: string;
};

export type PersonClient = {
  id: string;
  isSelf: boolean;
  isPlaceholder?: boolean;
  lastName: string;
  firstName: string;
  middleName: string;
  sex: string;
  birthDate: string;
  birthCity: string;
  birthCityCustom: string;
  phone: string;
  alive: boolean;
  deathDate: string;
  burialPlace: string;
  notes: string;
};

export type RelationshipClient = {
  id: string;
  userId: string;
  basePersonId: string;
  relatedPersonId: string;
  relationType: string;
  line: string;
};

export type TreeLinkKind = "parent" | "spouse" | "sibling";

export type TreeBuiltNode = {
  id: string;
  isSelf: boolean;
  isPlaceholder: boolean;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  data: PersonClient;
};

export type TreeBuiltLink = {
  type: string;
  from: string;
  to: string;
};

export type PositionOffset = { dx: number; dy: number };

export type TreeBuiltPayload = {
  selfId: string;
  nodes: TreeBuiltNode[];
  links: TreeBuiltLink[];
  unresolved: PersonClient[];
  positions: Record<string, PositionOffset>;
};

export type TreeApiResponse = {
  mePersonId: string;
  people: PersonClient[];
  relationships: RelationshipClient[];
  built: TreeBuiltPayload;
};

export type MapMarker = {
  lat: number;
  lon: number;
  label: string;
  person: PersonClient;
};

export type MapApiResponse = {
  filter: string;
  markers: MapMarker[];
};

export type AuthOkResponse = {
  ok?: boolean;
  token?: string;
};

export type MeResponse = {
  user: UserClient | null;
};

export type ApiErrorBody = {
  error?: string;
};
