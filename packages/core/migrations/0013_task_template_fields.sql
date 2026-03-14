ALTER TABLE tasks ADD COLUMN template_id TEXT REFERENCES task_templates(id);
ALTER TABLE tasks ADD COLUMN stage_id TEXT REFERENCES task_template_stages(id);
ALTER TABLE tasks ADD COLUMN properties TEXT;
ALTER TABLE tasks ADD COLUMN idea_id TEXT REFERENCES ideas(id);
