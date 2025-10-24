#!/usr/bin/env python3
"""
Convert CSV to SQL INSERT statements for D1 import
"""
import csv
import sys

def escape_sql_string(s):
    """Escape single quotes for SQL"""
    if s is None:
        return ''
    return s.replace("'", "''")

def main():
    input_file = 'output_search_index.csv'
    output_file = 'output_search_index.sql'
    batch_size = 500  # Insert 500 rows per statement
    
    print(f"Converting {input_file} to {output_file}...")
    
    with open(input_file, 'r', encoding='utf-8') as csvfile, \
         open(output_file, 'w', encoding='utf-8') as sqlfile:
        
        reader = csv.DictReader(csvfile)
        batch = []
        total = 0
        
        for row in reader:
            word = escape_sql_string(row['word'])
            language = escape_sql_string(row['language'])
            definition = escape_sql_string(row['definition'])
            pronunciation = escape_sql_string(row['pronunciation'])
            is_common = row['is_common']
            
            value = f"('{word}', '{language}', '{definition}', '{pronunciation}', {is_common})"
            batch.append(value)
            total += 1
            
            if len(batch) >= batch_size:
                sqlfile.write("INSERT INTO dictionary_search (word, language, definition, pronunciation, is_common) VALUES\n")
                sqlfile.write(",\n".join(batch))
                sqlfile.write(";\n\n")
                batch = []
                
                if total % 10000 == 0:
                    print(f"  Processed {total} rows...")
        
        # Write remaining batch
        if batch:
            sqlfile.write("INSERT INTO dictionary_search (word, language, definition, pronunciation, is_common) VALUES\n")
            sqlfile.write(",\n".join(batch))
            sqlfile.write(";\n")
    
    print(f"✅ Converted {total} rows to SQL")
    print(f"📝 Output: {output_file}")

if __name__ == '__main__':
    main()

