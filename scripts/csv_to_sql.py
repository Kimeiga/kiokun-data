#!/usr/bin/env python3
"""Convert CSV to SQL INSERT statements for D1 import."""

import csv
import sys

def escape_sql(value):
    """Escape single quotes for SQL."""
    if value is None:
        return 'NULL'
    return "'" + str(value).replace("'", "''") + "'"

def main():
    input_file = sys.argv[1] if len(sys.argv) > 1 else 'output_search_index.csv'
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'output_search_index.sql'
    batch_size = 500  # Number of rows per INSERT statement
    
    print(f"Converting {input_file} to {output_file}...")
    
    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8') as outfile:
        
        reader = csv.reader(infile)
        header = next(reader)  # Skip header
        
        # Columns: word, language, definition, pronunciation, reading_search, is_common
        
        rows = []
        total_rows = 0
        insert_count = 0
        
        for row in reader:
            if len(row) != 6:
                continue
            
            word, language, definition, pronunciation, reading_search, is_common = row
            
            values = f"({escape_sql(word)}, {escape_sql(language)}, {escape_sql(definition)}, {escape_sql(pronunciation)}, {escape_sql(reading_search)}, {is_common})"
            rows.append(values)
            total_rows += 1
            
            if len(rows) >= batch_size:
                outfile.write(f"INSERT INTO dictionary_search (word, language, definition, pronunciation, reading_search, is_common) VALUES\n")
                outfile.write(",\n".join(rows))
                outfile.write(";\n\n")
                rows = []
                insert_count += 1
                
                if insert_count % 100 == 0:
                    print(f"  Written {total_rows} rows...")
        
        # Write remaining rows
        if rows:
            outfile.write(f"INSERT INTO dictionary_search (word, language, definition, pronunciation, reading_search, is_common) VALUES\n")
            outfile.write(",\n".join(rows))
            outfile.write(";\n")
            insert_count += 1
        
        print(f"Done! Total rows: {total_rows}, INSERT statements: {insert_count}")

if __name__ == '__main__':
    main()

