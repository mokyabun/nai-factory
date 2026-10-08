ALTER TABLE vibe_transfers ADD COLUMN encoded_asset_id integer REFERENCES assets(id);
--> statement-breakpoint
CREATE INDEX vibe_transfers_encoded_asset_id_idx ON vibe_transfers (encoded_asset_id);
