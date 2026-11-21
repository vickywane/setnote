-- Built-in exercise catalog (VIC-59). Rows have no user_id, so every user can read
-- them and nobody can change them through the Data API. Aliases are lower-case and
-- are used to match free-text notes ("db curl" -> Bicep curl).

insert into public.exercises (name, muscle_group, equipment, aliases) values
  -- Chest
  ('Bench press', 'Chest', '{barbell,dumbbell,smith_machine}', '{bench,flat bench,bb bench,barbell bench,bench press}'),
  ('Incline bench press', 'Chest', '{barbell,dumbbell,smith_machine}', '{incline bench,incline press,incline}'),
  ('Dumbbell fly', 'Chest', '{dumbbell}', '{db fly,flyes,flys,chest fly}'),
  ('Cable crossover', 'Chest', '{cable}', '{crossover,cable fly,cable crossovers}'),
  ('Chest press machine', 'Chest', '{machine}', '{chest press,machine press}'),
  ('Push-up', 'Chest', '{bodyweight}', '{pushup,push up,pushups,push ups}'),
  ('Dip', 'Chest', '{bodyweight}', '{dips,chest dip,tricep dip}'),
  -- Back
  ('Deadlift', 'Back', '{barbell}', '{dl,deads,conventional deadlift}'),
  ('Pull-up', 'Back', '{bodyweight}', '{pullup,pull up,pullups,pull ups,chin up,chin-up,chinup}'),
  ('Lat pulldown', 'Back', '{cable,machine}', '{pulldown,lat pull down,lat pull,pull down}'),
  ('Barbell row', 'Back', '{barbell}', '{bb row,bent over row,bent-over row,row}'),
  ('Dumbbell row', 'Back', '{dumbbell}', '{db row,one arm row,single arm row}'),
  ('Seated cable row', 'Back', '{cable}', '{cable row,seated row,low row}'),
  -- Shoulders
  ('Overhead press', 'Shoulders', '{barbell,dumbbell,smith_machine}', '{ohp,shoulder press,military press,press}'),
  ('Lateral raise', 'Shoulders', '{dumbbell,cable}', '{lat raise,side raise,lateral raises,side lateral raise}'),
  ('Face pull', 'Shoulders', '{cable}', '{face pulls}'),
  ('Rear delt fly', 'Shoulders', '{dumbbell,machine,cable}', '{rear delt,reverse fly,rear fly}'),
  -- Arms
  ('Bicep curl', 'Arms', '{dumbbell,barbell,cable}', '{curl,curls,arm curl,arm curls,bicep curls,biceps curl,db curl,bb curl,cable curl}'),
  ('Hammer curl', 'Arms', '{dumbbell}', '{hammer curls,hammers}'),
  ('Tricep pushdown', 'Arms', '{cable}', '{pushdown,tricep push down,triceps pushdown,rope pushdown}'),
  ('Skull crusher', 'Arms', '{barbell,dumbbell}', '{skullcrusher,skull crushers,lying tricep extension}'),
  ('Overhead tricep extension', 'Arms', '{dumbbell,cable}', '{tricep extension,overhead extension}'),
  -- Legs
  ('Squat', 'Legs', '{barbell,smith_machine}', '{back squat,squats,bb squat}'),
  ('Front squat', 'Legs', '{barbell}', '{front squats}'),
  ('Leg press', 'Legs', '{machine}', '{seated leg press,legpress}'),
  ('Romanian deadlift', 'Legs', '{barbell,dumbbell}', '{rdl,rdls,romanian dl,stiff leg deadlift}'),
  ('Lunge', 'Legs', '{dumbbell,barbell,bodyweight}', '{lunges,walking lunge,walking lunges}'),
  ('Bulgarian split squat', 'Legs', '{dumbbell,bodyweight}', '{bss,split squat,bulgarians}'),
  ('Leg extension', 'Legs', '{machine}', '{leg extensions,quad extension}'),
  ('Leg curl', 'Legs', '{machine}', '{hamstring curl,leg curls,lying leg curl,seated leg curl}'),
  ('Hip thrust', 'Legs', '{barbell,machine}', '{hip thrusts,glute bridge}'),
  ('Calf raise', 'Legs', '{machine,bodyweight,smith_machine}', '{calf raises,calves,standing calf raise}'),
  ('Goblet squat', 'Legs', '{dumbbell,kettlebell}', '{goblet squats}'),
  -- Core
  ('Plank', 'Core', '{bodyweight}', '{planks}'),
  ('Hanging leg raise', 'Core', '{bodyweight}', '{leg raise,leg raises,hanging leg raises}'),
  ('Cable crunch', 'Core', '{cable}', '{cable crunches,kneeling crunch}'),
  ('Crunch', 'Core', '{bodyweight}', '{crunches,sit up,sit-up,situps}'),
  -- Full body
  ('Kettlebell swing', 'Full body', '{kettlebell}', '{kb swing,swings,kettlebell swings}'),
  ('Farmer''s carry', 'Full body', '{dumbbell,kettlebell}', '{farmers carry,farmer carry,farmers walk}');
