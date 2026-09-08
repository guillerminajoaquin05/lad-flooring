-- Semilla del catálogo: mismos datos que hoy están hardcodeados en products.js / services.js.
-- Correr una sola vez en el SQL Editor de Supabase.

insert into public.products (id, name, line, category, price, old_price, image_url, stock, hidden, description) values
('bona-jabon-1l', 'Jabón de Limpieza Bona para Pisos de Madera 1L', 'bona', 'Mantenimiento', 18500, null, 'ph-3', 24, false, 'Limpiador específico para pisos de madera lacados. Fórmula a base de agua, no deja residuos ni vuelve resbaladizo el piso. Ideal para el mantenimiento diario.'),
('bona-kit-refresh', 'Kit Bona Floor Refresher', 'bona', 'Mantenimiento', 34900, 39900, 'ph-4', 12, false, 'Renová el brillo de tu piso lacado sin necesidad de pulido. Incluye aplicador de microfibra y renovador de acabado Bona.'),
('bona-mop', 'Mopa Bona Spray Mop', 'bona', 'Herramientas', 27500, null, 'ph-3', 8, false, 'Mopa con sistema de spray incorporado para una limpieza rápida y pareja, sin exceso de agua sobre la madera.'),
('flotante-roble-natural', 'Piso Flotante Roble Natural AC4', 'flotantes', 'Pisos Flotantes', 12800, null, 'ph-1', 340, false, 'Precio por m². Laminado de alta resistencia AC4, apto para uso residencial intensivo. Sistema de encastre click, instalación flotante sin pegamento.'),
('flotante-nogal-oscuro', 'Piso Flotante Nogal Oscuro AC5', 'flotantes', 'Pisos Flotantes', 15200, 16900, 'ph-5', 210, false, 'Precio por m². Terminado en tono nogal oscuro con textura sincronizada. Resistencia AC5 apta para uso comercial moderado.'),
('flotante-roble-gris', 'Piso Flotante Roble Gris Ceniza', 'flotantes', 'Pisos Flotantes', 13900, null, 'ph-2', 95, false, 'Precio por m². Tono gris ceniza de estética contemporánea, bisel en 4 lados para un acabado prolijo.'),
('bona-cera-exterior', 'Protector Bona para Deck Exterior', 'bona', 'Mantenimiento', 41200, null, 'ph-5', 6, true, 'Protección UV e hidrofugante para maderas exteriores. Alta resistencia a la intemperie.')
on conflict (id) do nothing;

insert into public.services (id, name, category, image_url, short_description, description, includes, hidden) values
('pulido-hidrolaqueado', 'Pulido e Hidrolaqueado', 'Pisos de Madera', 'ph-1',
  'Recuperamos el brillo y la protección original del piso, eliminando rayones y marcas de uso con máquinas profesionales.',
  'Con el tiempo, todo piso de madera pierde brillo y queda expuesto a rayones, manchas y desgaste. El pulido elimina esa capa superficial dañada y nivela la superficie, mientras que el hidrolaqueado aplica una nueva capa de protección a base de agua que devuelve el brillo original y protege la madera del uso diario.',
  array['Evaluación técnica del estado actual del piso','Pulido con máquinas profesionales de bajo nivel de polvo','Aplicación de hidrolaca en 2 o 3 manos según el uso del ambiente','Protección lista para uso en 24-48 hs según ventilación'],
  false),
('colocacion-pisos-flotantes', 'Colocación de Pisos Flotantes', 'Pisos de Madera', 'ph-2',
  'Instalación de pisos laminados y vinílicos con o sin colocación de zócalos, en departamentos, locales y oficinas.',
  'Instalamos pisos flotantes laminados y vinílicos con sistema de encastre, sin necesidad de pegamento ni obra húmeda. Es una solución rápida y prolija, ideal para renovar departamentos, locales comerciales u oficinas sin interrumpir la actividad por mucho tiempo.',
  array['Nivelación previa de la superficie existente','Colocación con manta acústica incluida','Colocación de zócalos y perfiles de terminación (opcional)','Obra en seco: sin tiempos de secado ni olores'],
  false),
('colocacion-madera-maciza', 'Colocación de Madera Maciza', 'Pisos de Madera', 'ph-3',
  'Colocación tradicional de tablones de madera maciza, con machimbrado y terminación a elección.',
  'La colocación tradicional de madera maciza machihembrada sigue siendo la elección de quienes buscan un piso de máxima calidez y durabilidad. Trabajamos con distintas especies y anchos de tabla, adaptando la instalación a la base existente (contrapiso, machimbre o piso antiguo).',
  array['Asesoramiento sobre especie y ancho de tabla según el ambiente','Colocación clavada o pegada según el tipo de base','Lijado y terminación final a elección (hidrolaca o cera)','Garantía de mano de obra'],
  false),
('colocacion-decks', 'Colocación de Decks', 'Outdoors', 'ph-2',
  'Decks de madera y WPC para exteriores, pérgolas y espacios de esparcimiento, resistentes a la intemperie.',
  'Diseñamos y colocamos decks exteriores en madera natural o WPC (madera plástica compuesta), pensados para resistir sol, lluvia y uso intensivo sin perder su estética. Ideal para patios, piscinas, balcones y espacios de esparcimiento.',
  array['Relevamiento y diseño del despiece según el espacio','Estructura de apoyo y ventilación adecuada para exteriores','Colocación de tablas con fijación oculta o vista','Recomendación de mantenimiento según el material elegido'],
  false),
('proteccion-exteriores', 'Protección para Exteriores', 'Outdoors', 'ph-5',
  'Aplicación de productos hidrofugantes y protectores UV para prolongar la vida útil de tu deck o pérgola.',
  'La madera expuesta a la intemperie necesita mantenimiento periódico para conservar su color y resistencia. Aplicamos productos hidrofugantes y protectores UV de uso profesional que retrasan el envejecimiento natural de la madera y previenen el resecamiento y las rajaduras.',
  array['Limpieza e hidrolavado previo de la superficie','Aplicación de protector UV e hidrofugante','Recomendación de frecuencia de reaplicación','Apto para decks, pérgolas y revestimientos exteriores'],
  false),
('pisos-deportivos', 'Pisos para Gimnasios y Canchas', 'Pisos Deportivos', 'ph-4',
  'Instalación de pisos deportivos de alto rendimiento, pensados para el uso intensivo en clubes y gimnasios.',
  'Instalamos sistemas de pisos deportivos de alto rendimiento para gimnasios, salas de musculación y canchas techadas. Priorizamos la absorción de impacto, el agarre y la durabilidad frente al uso intensivo propio de un club o centro deportivo.',
  array['Relevamiento técnico según el deporte o uso previsto','Sistemas con absorción de impacto certificada','Instalación con juntas selladas para uso intensivo','Asesoramiento sobre mantenimiento y limpieza'],
  false)
on conflict (id) do nothing;
