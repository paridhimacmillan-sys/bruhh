trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=dataset,
    dataset_text_field="text",
    max_seq_length=2048,

    args=TrainingArguments(
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,

        num_train_epochs=1,
        max_steps=-1,

        warmup_steps=50,
        learning_rate=2e-4,

        fp16=not torch.cuda.is_bf16_supported(),
        bf16=torch.cuda.is_bf16_supported(),

        logging_steps=10,
        save_steps=500,

        optim="adamw_8bit",
        weight_decay=0.01,
        lr_scheduler_type="linear",
        seed=3407,

        output_dir="outputs",
    ),
)
